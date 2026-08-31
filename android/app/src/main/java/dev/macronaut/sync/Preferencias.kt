package dev.macronaut.sync

import android.content.Context

/**
 * O que o app guarda entre execuções: o token do dispositivo e até onde já
 * sincronizou.
 *
 * `SharedPreferences` privado do app, sem criptografia adicional. O token não
 * abre o banco — ele só vale em `/api/ingest`, que é tipada, e some quando o
 * aparelho é desconectado pela tela do Macronaut. Guardar num cofre um
 * segredo que já é de baixo privilégio dá uma sensação de segurança sem
 * mudar o que um atacante com acesso ao arquivo conseguiria fazer.
 */
class Preferencias(context: Context) {
    private val prefs = context.getSharedPreferences("macronaut", Context.MODE_PRIVATE)

    var token: String?
        get() = prefs.getString("token", null)
        set(v) = prefs.edit().putString("token", v).apply()

    /** Instante da última sincronização bem-sucedida, em milissegundos. */
    var ultimaSync: Long
        get() = prefs.getLong("ultima_sync", 0L)
        set(v) = prefs.edit().putLong("ultima_sync", v).apply()

    val pareado: Boolean get() = token != null

    fun esquecer() = prefs.edit().clear().apply()
}
