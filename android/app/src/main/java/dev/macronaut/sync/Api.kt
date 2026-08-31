package dev.macronaut.sync

import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

/**
 * As duas rotas do servidor que este app conhece.
 *
 * `HttpURLConnection` e `org.json` em vez de Retrofit/Moshi: são duas chamadas
 * com dois corpos JSON, e uma pilha de rede inteira para isso é peso no APK e
 * mais uma coisa para atualizar.
 */
class Api(private val base: String) {

    class Falha(val status: Int, mensagem: String) : Exception(mensagem)

    /** Troca o código de oito caracteres por um token de dispositivo. */
    fun parear(codigo: String, nomeDoAparelho: String): String {
        val corpo = JSONObject()
            .put("codigo", codigo)
            .put("nome", nomeDoAparelho)
            .put("plataforma", "android")
        val resposta = post("/api/parear", corpo.toString(), token = null)
        return JSONObject(resposta).getString("token")
    }

    /** Manda o lote. Devolve quantos itens o servidor gravou. */
    fun enviar(token: String, lote: Lote): JSONObject =
        JSONObject(post("/api/ingest", lote.paraJson().toString(), token))

    private fun post(caminho: String, corpo: String, token: String?): String {
        val conexao = (URL(base + caminho).openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            doOutput = true
            connectTimeout = 15_000
            readTimeout = 30_000
            setRequestProperty("Content-Type", "application/json")
            token?.let { setRequestProperty("Authorization", "Bearer $it") }
        }
        try {
            conexao.outputStream.use { it.write(corpo.toByteArray(Charsets.UTF_8)) }
            val status = conexao.responseCode
            val fluxo = if (status in 200..299) conexao.inputStream else conexao.errorStream
            val texto = fluxo?.bufferedReader()?.use { it.readText() } ?: ""
            if (status !in 200..299) {
                // A mensagem do servidor sobe inteira: "401 dispositivo
                // revogado" é a diferença entre "reconecte" e "tente de novo".
                val erro = runCatching { JSONObject(texto).getString("error") }.getOrDefault(texto)
                throw Falha(status, erro)
            }
            return texto
        } finally {
            conexao.disconnect()
        }
    }
}
