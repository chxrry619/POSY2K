package com.chrrysdump.pos;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.Window;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.IOException;
import java.io.InputStream;
import java.util.HashMap;

/**
 * ChrrysDump: muestra la app web (carpeta assets/www) a pantalla completa.
 * Todo funciona sin internet: los archivos vienen dentro del APK y los
 * datos se guardan en el teléfono (IndexedDB del WebView).
 */
public class MainActivity extends Activity {

    /** Dirección interna: no sale a internet, la app la sirve desde assets/www */
    private static final String HOST = "appassets.androidplatform.net";
    private static final String INICIO = "https://" + HOST + "/index.html";
    private static final int ELEGIR_ARCHIVO = 1;
    private static final int COLOR_FONDO = Color.parseColor("#120808");

    private WebView web;
    private ValueCallback<Uri[]> callbackArchivo;

    @Override
    protected void onCreate(Bundle estado) {
        super.onCreate(estado);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().setStatusBarColor(COLOR_FONDO);
        getWindow().setNavigationBarColor(COLOR_FONDO);

        web = new WebView(this);
        web.setBackgroundColor(COLOR_FONDO);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);          // localStorage
        s.setDatabaseEnabled(true);            // IndexedDB
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(true);         // para elegir fotos de la galería
        s.setTextZoom(100);                    // conserva el diseño pixel aunque el sistema use letra grande

        web.addJavascriptInterface(new Puente(), "AndroidApp");
        web.setWebViewClient(new Cliente());
        web.setWebChromeClient(new ClienteChrome());

        if (estado != null) web.restoreState(estado);
        else web.loadUrl(INICIO);

        setContentView(web);
    }

    /* ---------- Sirve los archivos de assets/www ---------- */
    private class Cliente extends WebViewClient {
        @Override
        public WebResourceResponse shouldInterceptRequest(WebView vista, WebResourceRequest pet) {
            Uri url = pet.getUrl();
            if (!HOST.equals(url.getHost())) return null;
            String ruta = url.getPath();
            if (ruta == null || ruta.equals("/") || ruta.isEmpty()) ruta = "/index.html";
            try {
                InputStream datos = getAssets().open("www" + ruta);
                String tipo = tipoMime(ruta);
                String codif = tipo.startsWith("text/") || tipo.endsWith("javascript") ? "UTF-8" : null;
                return new WebResourceResponse(tipo, codif, datos);
            } catch (IOException e) {
                return new WebResourceResponse("text/plain", "UTF-8", 404, "No encontrado",
                        new HashMap<String, String>(), null);
            }
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView vista, WebResourceRequest pet) {
            Uri url = pet.getUrl();
            if (HOST.equals(url.getHost())) return false;
            // Cualquier enlace externo se abre en el navegador del teléfono
            try { startActivity(new Intent(Intent.ACTION_VIEW, url)); } catch (ActivityNotFoundException e) { }
            return true;
        }
    }

    private static String tipoMime(String ruta) {
        String r = ruta.toLowerCase();
        if (r.endsWith(".html")) return "text/html";
        if (r.endsWith(".css")) return "text/css";
        if (r.endsWith(".js")) return "application/javascript";
        if (r.endsWith(".json")) return "application/json";
        if (r.endsWith(".woff2")) return "font/woff2";
        if (r.endsWith(".woff")) return "font/woff";
        if (r.endsWith(".png")) return "image/png";
        if (r.endsWith(".jpg") || r.endsWith(".jpeg")) return "image/jpeg";
        if (r.endsWith(".webp")) return "image/webp";
        if (r.endsWith(".gif")) return "image/gif";
        if (r.endsWith(".svg")) return "image/svg+xml";
        if (r.endsWith(".ico")) return "image/x-icon";
        if (r.endsWith(".txt")) return "text/plain";
        return "application/octet-stream";
    }

    /* ---------- Elegir imágenes (artículos y fondo) ---------- */
    private class ClienteChrome extends WebChromeClient {
        @Override
        public boolean onShowFileChooser(WebView vista, ValueCallback<Uri[]> callback,
                                         FileChooserParams params) {
            if (callbackArchivo != null) callbackArchivo.onReceiveValue(null);
            callbackArchivo = callback;
            try {
                startActivityForResult(params.createIntent(), ELEGIR_ARCHIVO);
            } catch (ActivityNotFoundException e) {
                callbackArchivo = null;
                return false;
            }
            return true;
        }
    }

    @Override
    protected void onActivityResult(int codigo, int resultado, Intent datos) {
        super.onActivityResult(codigo, resultado, datos);
        if (codigo == ELEGIR_ARCHIVO && callbackArchivo != null) {
            callbackArchivo.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultado, datos));
            callbackArchivo = null;
        }
    }

    /* ---------- Funciones que la página puede llamar: AndroidApp.copiar(texto) ---------- */
    private class Puente {
        @JavascriptInterface
        public void copiar(String texto) {
            ClipboardManager cm = (ClipboardManager) getSystemService(CLIPBOARD_SERVICE);
            if (cm != null) cm.setPrimaryClip(ClipData.newPlainText("ChrrysDump", texto));
        }
    }

    /* ---------- Botón atrás: cierra ventanas; si no hay, minimiza la app ---------- */
    @Override
    public void onBackPressed() {
        web.evaluateJavascript("window.alPresionarAtras ? window.alPresionarAtras() : false",
                new ValueCallback<String>() {
                    @Override
                    public void onReceiveValue(String valor) {
                        if (!"true".equals(valor)) moveTaskToBack(true);
                    }
                });
    }

    @Override
    protected void onSaveInstanceState(Bundle salida) {
        super.onSaveInstanceState(salida);
        web.saveState(salida);
    }

    @Override
    protected void onPause() {
        super.onPause();
        web.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
    }
}
