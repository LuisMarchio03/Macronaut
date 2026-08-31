package dev.macronaut.sync

import org.json.JSONArray
import org.json.JSONObject

/**
 * O que vai para `/api/ingest`.
 *
 * A forma exata está fixada em `android/contrato/exemplo-lote.json`, e o
 * repositório web tem um teste (`api/_lib/contrato-android.test.ts`) que roda
 * aquele arquivo pela validação do servidor. É o mais perto de testar este
 * código que dá para chegar sem um Galaxy na mesa: se alguém mexer na
 * validação do servidor e quebrar este app, o teste de lá cai antes do deploy.
 */
data class Atividade(
    /** `metadata.id` do registro no Health Connect. É a chave da deduplicação. */
    val origemId: String,
    val data: String,
    val tipo: String,
    val duracaoMin: Double,
    val kcal: Double,
)

data class Peso(
    val data: String,
    val pesoKg: Double,
)

data class Agua(
    /** `metadata.id` do `HydrationRecord`. É a chave da deduplicação. */
    val origemId: String,
    val data: String,
    val ml: Double,
)

data class Lote(
    val atividades: List<Atividade>,
    val pesos: List<Peso>,
    val aguas: List<Agua>,
) {
    val vazio: Boolean get() = atividades.isEmpty() && pesos.isEmpty() && aguas.isEmpty()

    fun paraJson(): JSONObject = JSONObject()
        .put("origem", "health-connect")
        .put(
            "atividades",
            JSONArray().apply {
                atividades.forEach {
                    put(
                        JSONObject()
                            .put("origem_id", it.origemId)
                            .put("data", it.data)
                            .put("tipo", it.tipo)
                            .put("duracao_min", it.duracaoMin)
                            .put("kcal", it.kcal),
                    )
                }
            },
        )
        .put(
            "pesos",
            JSONArray().apply {
                pesos.forEach { put(JSONObject().put("data", it.data).put("peso_kg", it.pesoKg)) }
            },
        )
        .put(
            "aguas",
            JSONArray().apply {
                aguas.forEach {
                    put(
                        JSONObject()
                            .put("origem_id", it.origemId)
                            .put("data", it.data)
                            .put("ml", it.ml),
                    )
                }
            },
        )
}
