plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "dev.macronaut.app"
    compileSdk = 35

    defaultConfig {
        applicationId = "dev.macronaut.app"
        // O Health Connect pede 26+; a TWA funciona a partir do 21. 26 é o
        // piso que serve aos dois sem carregar caminho morto.
        minSdk = 26
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"

        // O domínio que a TWA abre e para onde o worker sincroniza. Trocar
        // aqui e no `public/.well-known/assetlinks.json` do site é o que faz a
        // verificação de Digital Asset Links passar — sem ela o app abre como
        // Custom Tab, com a barra de URL à mostra.
        resValue("string", "url_do_app", "https://macronaut-jade.vercel.app")
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            proguardFiles(getDefaultProguardFile("proguard-android-optimize.txt"), "proguard-rules.pro")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions { jvmTarget = "17" }
    buildFeatures { viewBinding = true }
}

dependencies {
    // A TWA: o Chrome renderiza o PWA em tela cheia, sem barra de URL.
    implementation("com.google.androidbrowserhelper:androidbrowserhelper:2.6.0")

    // O Health Connect. É por aqui que o Samsung Health chega — ele escreve
    // no Health Connect, e este app lê de lá.
    implementation("androidx.health.connect:connect-client:1.1.0")

    implementation("androidx.appcompat:appcompat:1.7.0")
    implementation("androidx.work:work-runtime-ktx:2.10.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.9.0")

    testImplementation("junit:junit:4.13.2")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.9.0")
}
