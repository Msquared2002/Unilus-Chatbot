package zm.ac.unilus.silverestsurvey;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.view.WindowManager;
import android.webkit.GeolocationPermissions;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

public final class MainActivity extends Activity {
    private static final String ORIGIN = "https://appassets.androidplatform.net";
    private static final int LOCATION_REQUEST = 11;
    private static final int EXPORT_REQUEST = 12;
    private WebView web;
    private GeolocationPermissions.Callback pendingLocation;
    private String pendingOrigin;
    private String pendingJson;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        web = new WebView(this);
        setContentView(web);
        web.getSettings().setJavaScriptEnabled(true);
        web.getSettings().setDomStorageEnabled(true);
        web.getSettings().setGeolocationEnabled(true);
        web.getSettings().setAllowFileAccess(false);
        web.getSettings().setAllowContentAccess(false);
        web.addJavascriptInterface(new SurveyBridge(), "AndroidSurvey");
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (!ORIGIN.equals(uri.getScheme() + "://" + uri.getHost())) return empty();
                String path = uri.getPath();
                if (path == null || !path.matches("/(dummy-environment/campus-survey(-core)?\\.(html|js)|dummy-environment/campus-survey\\.js|backend/data/campus/campus_(boundary|buildings|places|routing_graph|place_catalog)\\.json)")) return empty();
                try {
                    String mime = path.endsWith(".json") ? "application/json" : path.endsWith(".js") ? "text/javascript" : "text/html";
                    return new WebResourceResponse(mime, "UTF-8", getAssets().open("web" + path));
                } catch (IOException e) { return empty(); }
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) { return !ORIGIN.equals(request.getUrl().getScheme() + "://" + request.getUrl().getHost()); }
            private WebResourceResponse empty() { return new WebResourceResponse("text/plain", "UTF-8", new java.io.ByteArrayInputStream(new byte[0])); }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                Uri requested = Uri.parse(origin);
                if (!"https".equals(requested.getScheme()) || !"appassets.androidplatform.net".equals(requested.getHost())) {
                    callback.invoke(origin, false, false); return;
                }
                if (checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
                    checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED) {
                    callback.invoke(origin, true, false); return;
                }
                pendingLocation = callback; pendingOrigin = origin;
                requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION, Manifest.permission.ACCESS_COARSE_LOCATION}, LOCATION_REQUEST);
            }
        });
        web.loadUrl(ORIGIN + "/dummy-environment/campus-survey.html");
    }

    private final class SurveyBridge {
        @JavascriptInterface public void exportSurvey(String filename, String json) {
            runOnUiThread(() -> {
                if (json == null || json.length() > 25_000_000) { new AlertDialog.Builder(MainActivity.this).setMessage("Survey export is too large.").setPositiveButton("OK", null).show(); return; }
                pendingJson = json;
                Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("application/json");
                intent.putExtra(Intent.EXTRA_TITLE, filename.matches("silverest-survey-[0-9-]+\\.json") ? filename : "silverest-survey.json");
                startActivityForResult(intent, EXPORT_REQUEST);
            });
        }
        @JavascriptInterface public void setRecording(boolean active) {
            runOnUiThread(() -> { if (active) getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                else getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON); });
        }
    }

    @Override public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grants) {
        super.onRequestPermissionsResult(requestCode, permissions, grants);
        if (requestCode == LOCATION_REQUEST && pendingLocation != null) {
            boolean allowed = checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED ||
                checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION) == PackageManager.PERMISSION_GRANTED;
            pendingLocation.invoke(pendingOrigin, allowed, false);
            pendingLocation = null; pendingOrigin = null;
        }
    }
    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != EXPORT_REQUEST) return;
        if (resultCode == RESULT_OK && data != null && data.getData() != null && pendingJson != null) {
            Uri uri = data.getData();
            try (OutputStream out = getContentResolver().openOutputStream(uri, "w")) {
                if (out == null) throw new IOException("Could not open selected file");
                out.write(pendingJson.getBytes(StandardCharsets.UTF_8));
                new AlertDialog.Builder(this).setMessage("Survey saved. Share it now?")
                    .setPositiveButton("Share", (dialog, which) -> {
                        Intent send = new Intent(Intent.ACTION_SEND);
                        send.setType("application/json"); send.putExtra(Intent.EXTRA_STREAM, uri);
                        send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                        startActivity(Intent.createChooser(send, "Share Silverest survey"));
                    }).setNegativeButton("Done", null).show();
            } catch (IOException e) { new AlertDialog.Builder(this).setMessage("Export failed: " + e.getMessage()).setPositiveButton("OK", null).show(); }
        }
        pendingJson = null;
    }
    @Override protected void onPause() {
        if (web != null) { web.evaluateJavascript("window.CampusSurveyApp&&window.CampusSurveyApp.pauseForBackground()", null); web.onPause(); }
        getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        super.onPause();
    }
    @Override protected void onResume() { super.onResume(); if (web != null) web.onResume(); }
    @Override protected void onDestroy() { if (web != null) web.destroy(); super.onDestroy(); }
}
