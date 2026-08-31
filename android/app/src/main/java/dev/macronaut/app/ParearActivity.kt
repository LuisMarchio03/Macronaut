package dev.macronaut.app

import android.os.Build
import android.os.Bundle
import android.widget.Button
import android.widget.EditText
import android.widget.TextView
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.health.connect.client.PermissionController
import androidx.lifecycle.lifecycleScope
import dev.macronaut.sync.Api
import dev.macronaut.sync.Preferencias
import dev.macronaut.sync.Saude
import dev.macronaut.sync.SyncWorker
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * A única tela nativa do app.
 *
 * Ela existe porque o pareamento é o único momento em que o nativo precisa
 * falar com a pessoa: a TWA não tem ponte para a página web, então o código
 * digitado aqui não teria como chegar ao worker se a tela fosse do site.
 *
 * A ordem importa: primeiro a permissão do Health Connect, depois o código. Um
 * app pareado e sem permissão sincroniza vazio para sempre, e o único sinal
 * seria o "ainda sem enviar nada" na outra ponta.
 */
class ParearActivity : AppCompatActivity() {

    private lateinit var prefs: Preferencias
    private lateinit var saude: Saude

    private val pedirPermissoes =
        registerForActivityResult(PermissionController.createRequestPermissionResultContract()) { concedidas ->
            if (!concedidas.containsAll(Saude.PERMISSOES)) {
                aviso(getString(R.string.parear_erro_permissao))
            }
        }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_parear)
        prefs = Preferencias(this)
        saude = Saude(this)

        findViewById<TextView>(R.id.explicacao).text = getString(R.string.parear_explicacao)
        val campo = findViewById<EditText>(R.id.codigo)

        if (!saude.disponivel) {
            aviso(getString(R.string.sem_health_connect))
        }

        findViewById<Button>(R.id.conectar).setOnClickListener {
            val codigo = campo.text.toString().trim()
            if (codigo.length < 8) {
                aviso(getString(R.string.parear_erro))
                return@setOnClickListener
            }
            parear(codigo)
        }
    }

    override fun onResume() {
        super.onResume()
        lifecycleScope.launch {
            if (saude.disponivel && !saude.temPermissoes()) pedirPermissoes.launch(Saude.PERMISSOES)
        }
    }

    private fun parear(codigo: String) = lifecycleScope.launch {
        val resultado = withContext(Dispatchers.IO) {
            runCatching { Api(SyncWorker.BASE).parear(codigo, nomeDoAparelho()) }
        }
        resultado
            .onSuccess { token ->
                prefs.token = token
                SyncWorker.agendar(applicationContext)
                aviso(getString(R.string.parear_ok))
                finish()
            }
            .onFailure { aviso(getString(R.string.parear_erro)) }
    }

    /** "Galaxy S24" — o que a pessoa vai reconhecer na lista de aparelhos. */
    private fun nomeDoAparelho(): String =
        listOfNotNull(Build.MANUFACTURER?.replaceFirstChar { it.uppercase() }, Build.MODEL)
            .joinToString(" ")
            .ifBlank { "Aparelho Android" }

    private fun aviso(texto: String) = Toast.makeText(this, texto, Toast.LENGTH_LONG).show()
}
