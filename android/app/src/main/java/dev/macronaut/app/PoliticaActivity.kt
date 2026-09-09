package dev.macronaut.app

import android.os.Bundle
import android.widget.TextView
import androidx.appcompat.app.AppCompatActivity

/**
 * A política de privacidade, exigida pelo Health Connect.
 *
 * É para cá que vai quem toca em "Política de privacidade" no diálogo de
 * permissões. O texto tem que ser o MESMO que for declarado no Play Console —
 * divergir entre os dois é motivo de reprovação na revisão.
 */
class PoliticaActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_politica)
        title = getString(R.string.politica_titulo)
        findViewById<TextView>(R.id.texto).text = getString(R.string.politica_texto)
    }
}
