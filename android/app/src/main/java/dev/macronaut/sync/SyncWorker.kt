package dev.macronaut.sync

import android.content.Context
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.NetworkType
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import java.util.concurrent.TimeUnit

/**
 * A sincronização periódica: lê o Health Connect e manda para o Macronaut.
 *
 * `WorkManager` e não um serviço: ele sobrevive a reinício do aparelho,
 * respeita o Doze e não pede a permissão de primeiro plano — que o Google
 * cobraria caro numa revisão para "mandar um JSON de vez em quando".
 */
class SyncWorker(context: Context, params: WorkerParameters) : CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        val prefs = Preferencias(applicationContext)
        val token = prefs.token ?: return Result.success() // sem pareamento, nada a fazer

        val saude = Saude(applicationContext)
        if (!saude.disponivel || !saude.temPermissoes()) return Result.success()

        return try {
            val lote = saude.ler()
            if (lote.vazio) return Result.success()

            Api(BASE).enviar(token, lote)
            prefs.ultimaSync = System.currentTimeMillis()
            Result.success()
        } catch (e: Api.Falha) {
            // 401 é definitivo: o aparelho foi desconectado pela tela do
            // Macronaut, e insistir só gastaria bateria. O token é esquecido
            // para o app voltar a pedir pareamento em vez de falhar calado.
            if (e.status == 401) {
                prefs.esquecer()
                Result.success()
            } else {
                Result.retry()
            }
        } catch (e: Exception) {
            Result.retry()
        }
    }

    companion object {
        const val BASE = "https://macronaut-jade.vercel.app"
        private const val NOME = "macronaut-sync"

        /**
         * Seis horas.
         *
         * O dado não é urgente: um treino que chega à noite conta no mesmo dia
         * do mesmo jeito. Intervalo curto aqui é bateria gasta para adiantar
         * um número que ninguém está olhando. `KEEP` para reagendar não zerar
         * o ciclo a cada abertura do app.
         */
        fun agendar(context: Context) {
            val pedido = PeriodicWorkRequestBuilder<SyncWorker>(6, TimeUnit.HOURS)
                .setConstraints(
                    Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build(),
                )
                .build()
            WorkManager.getInstance(context)
                .enqueueUniquePeriodicWork(NOME, ExistingPeriodicWorkPolicy.KEEP, pedido)
        }

        fun cancelar(context: Context) {
            WorkManager.getInstance(context).cancelUniqueWork(NOME)
        }
    }
}
