package dev.macronaut.sync

import android.content.Context
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.aggregate.AggregationResult
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.HydrationRecord
import androidx.health.connect.client.records.TotalCaloriesBurnedRecord
import androidx.health.connect.client.records.WeightRecord
import androidx.health.connect.client.request.AggregateRequest
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import java.time.Instant
import java.time.ZoneId
import java.time.temporal.ChronoUnit

/**
 * A leitura do Health Connect — que é por onde o Samsung Health chega.
 *
 * O Samsung Health não é lido direto: ele ESCREVE no Health Connect, e este
 * app lê de lá. Isso é de propósito, e não um desvio: o mesmo código serve a
 * quem usa Garmin, Fitbit ou o relógio do Google, sem uma linha a mais.
 */
class Saude(private val context: Context) {

    companion object {
        /** As três permissões que o app pede — e as únicas que ele usa. */
        val PERMISSOES = setOf(
            HealthPermission.getReadPermission(ExerciseSessionRecord::class),
            HealthPermission.getReadPermission(TotalCaloriesBurnedRecord::class),
            HealthPermission.getReadPermission(WeightRecord::class),
            HealthPermission.getReadPermission(HydrationRecord::class),
        )

        /**
         * Quantos dias para trás cada sincronização relê.
         *
         * Reler é barato e a deduplicação do servidor absorve a repetição. O
         * que não é barato é o buraco: um relógio que sincroniza tarde grava
         * o treino de ontem depois de a janela de ontem ter passado, e sem a
         * sobreposição aquele treino nunca chegaria.
         */
        const val JANELA_DIAS = 7L
    }

    val disponivel: Boolean
        get() = HealthConnectClient.getSdkStatus(context) == HealthConnectClient.SDK_AVAILABLE

    private val cliente: HealthConnectClient get() = HealthConnectClient.getOrCreate(context)

    suspend fun temPermissoes(): Boolean =
        cliente.permissionController.getGrantedPermissions().containsAll(PERMISSOES)

    /** Tudo o que aconteceu na janela, pronto para virar lote. */
    suspend fun ler(agora: Instant = Instant.now()): Lote {
        val inicio = agora.minus(JANELA_DIAS, ChronoUnit.DAYS)
        return Lote(
            atividades = lerAtividades(inicio, agora),
            pesos = lerPesos(inicio, agora),
            aguas = lerAguas(inicio, agora),
        )
    }

    private suspend fun lerAtividades(inicio: Instant, fim: Instant): List<Atividade> {
        val sessoes = cliente.readRecords(
            ReadRecordsRequest(
                recordType = ExerciseSessionRecord::class,
                timeRangeFilter = TimeRangeFilter.between(inicio, fim),
            ),
        ).records

        return sessoes.mapNotNull { sessao ->
            val minutos = ChronoUnit.SECONDS.between(sessao.startTime, sessao.endTime) / 60.0
            // Sessão de duração zero acontece (registro interrompido) e o
            // servidor recusa — filtrar aqui evita um lote inteiro rejeitado
            // por causa de uma linha.
            if (minutos <= 0) return@mapNotNull null

            Atividade(
                origemId = sessao.metadata.id,
                data = sessao.startTime.atZone(fusoDe(sessao)).toLocalDate().toString(),
                tipo = sessao.title?.takeIf { it.isNotBlank() } ?: nomeDoTipo(sessao.exerciseType),
                duracaoMin = arredondar(minutos),
                kcal = arredondar(kcalDe(sessao)),
            )
        }
    }

    /**
     * As calorias da sessão.
     *
     * `ExerciseSessionRecord` não carrega caloria: ela vive em
     * `TotalCaloriesBurnedRecord`, e o jeito de casar as duas é agregar pelo
     * intervalo da sessão. Sem dado de caloria a sessão ainda vale — ela conta
     * como treino no histórico, só não move o balanço energético.
     */
    private suspend fun kcalDe(sessao: ExerciseSessionRecord): Double {
        val r: AggregationResult = cliente.aggregate(
            AggregateRequest(
                metrics = setOf(TotalCaloriesBurnedRecord.ENERGY_TOTAL),
                timeRangeFilter = TimeRangeFilter.between(sessao.startTime, sessao.endTime),
            ),
        )
        return r[TotalCaloriesBurnedRecord.ENERGY_TOTAL]?.inKilocalories ?: 0.0
    }

    private suspend fun lerPesos(inicio: Instant, fim: Instant): List<Peso> {
        val registros = cliente.readRecords(
            ReadRecordsRequest(
                recordType = WeightRecord::class,
                timeRangeFilter = TimeRangeFilter.between(inicio, fim),
            ),
        ).records

        // Uma pesagem por dia, a mais recente: é a forma que `weigh_ins` tem
        // (UNIQUE por user e data), e mandar cinco do mesmo dia só faria o
        // servidor sobrescrever quatro vezes.
        return registros
            .groupBy { it.time.atZone(ZoneId.systemDefault()).toLocalDate() }
            .map { (dia, doDia) ->
                val ultimo = doDia.maxBy { it.time }
                Peso(data = dia.toString(), pesoKg = arredondar(ultimo.weight.inKilograms))
            }
    }

    /**
     * Os goles do período.
     *
     * Um por registro, não somados por dia: cada `HydrationRecord` tem
     * `metadata.id`, e é ele que faz a releitura da janela não somar o mesmo
     * gole de novo. Agrupar por dia aqui destruiria justamente essa chave.
     */
    private suspend fun lerAguas(inicio: Instant, fim: Instant): List<Agua> {
        val registros = cliente.readRecords(
            ReadRecordsRequest(
                recordType = HydrationRecord::class,
                timeRangeFilter = TimeRangeFilter.between(inicio, fim),
            ),
        ).records

        return registros.mapNotNull { r ->
            val ml = r.volume.inMilliliters
            if (ml < 1) return@mapNotNull null
            Agua(
                origemId = r.metadata.id,
                data = r.startTime.atZone(ZoneId.systemDefault()).toLocalDate().toString(),
                ml = arredondar(ml),
            )
        }
    }

    private fun fusoDe(sessao: ExerciseSessionRecord): ZoneId =
        sessao.startZoneOffset?.let { ZoneId.ofOffset("UTC", it) } ?: ZoneId.systemDefault()

    private fun arredondar(v: Double): Double = Math.round(v * 10.0) / 10.0

    /**
     * O nome que o Macronaut mostra.
     *
     * Só entra o que o app tem como distinguir — o resto vira "Exercício", que
     * é honesto: o tipo detalhado do Health Connect não muda nenhuma conta
     * deste lado, porque a caloria vem medida, não estimada por MET.
     */
    private fun nomeDoTipo(tipo: Int): String = when (tipo) {
        ExerciseSessionRecord.EXERCISE_TYPE_RUNNING,
        ExerciseSessionRecord.EXERCISE_TYPE_RUNNING_TREADMILL -> "Corrida"
        ExerciseSessionRecord.EXERCISE_TYPE_WALKING -> "Caminhada"
        ExerciseSessionRecord.EXERCISE_TYPE_BIKING,
        ExerciseSessionRecord.EXERCISE_TYPE_BIKING_STATIONARY -> "Bicicleta"
        ExerciseSessionRecord.EXERCISE_TYPE_SWIMMING_POOL,
        ExerciseSessionRecord.EXERCISE_TYPE_SWIMMING_OPEN_WATER -> "Natação"
        ExerciseSessionRecord.EXERCISE_TYPE_STRENGTH_TRAINING,
        ExerciseSessionRecord.EXERCISE_TYPE_WEIGHTLIFTING -> "Musculação"
        ExerciseSessionRecord.EXERCISE_TYPE_HIGH_INTENSITY_INTERVAL_TRAINING -> "HIIT"
        ExerciseSessionRecord.EXERCISE_TYPE_ELLIPTICAL -> "Elíptico"
        ExerciseSessionRecord.EXERCISE_TYPE_ROWING,
        ExerciseSessionRecord.EXERCISE_TYPE_ROWING_MACHINE -> "Remo"
        ExerciseSessionRecord.EXERCISE_TYPE_BOXING -> "Boxe"
        ExerciseSessionRecord.EXERCISE_TYPE_MARTIAL_ARTS -> "Luta"
        else -> "Exercício"
    }
}
