package com.app.jcmradiorock;

import android.content.ComponentName;
import android.os.Handler;
import android.os.Looper;
import androidx.media3.common.Player;
import androidx.media3.session.MediaController;
import androidx.media3.session.SessionToken;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.google.common.util.concurrent.ListenableFuture;
import java.util.concurrent.ExecutionException;

@CapacitorPlugin(name = "JcmRadio")
public class RadioPlugin extends Plugin {
    private final Handler main = new Handler(Looper.getMainLooper());
    private ListenableFuture<MediaController> connection;
    private MediaController controller;
    private boolean destroyed;

    private JSObject state() {
        JSObject data = new JSObject();
        data.put("status", controller.isPlaying() ? "playing" :
            controller.getPlayWhenReady() ? "loading" : "idle");
        return data;
    }

    private interface Action { void run(MediaController radio); }

    private void connected(PluginCall call, Action action) {
        main.post(() -> {
            if (destroyed) { call.reject("Actividad cerrada"); return; }
            if (connection == null) {
                SessionToken token = new SessionToken(getContext(), new ComponentName(getContext(), RadioService.class));
                connection = new MediaController.Builder(getContext(), token).buildAsync();
            }
            ListenableFuture<MediaController> pending = connection;
            pending.addListener(() -> {
                if (destroyed) { call.reject("Actividad cerrada"); return; }
                try {
                    MediaController current = pending.get();
                    if (!current.isConnected()) throw new IllegalStateException("Servicio desconectado");
                    if (controller != current) {
                        controller = current;
                        controller.addListener(new Player.Listener() {
                            @Override public void onEvents(Player player, Player.Events events) {
                                notifyListeners("state", state());
                            }
                        });
                    }
                    action.run(current);
                    call.resolve(state());
                } catch (InterruptedException ex) {
                    Thread.currentThread().interrupt();
                    call.reject("Conexión interrumpida", ex);
                } catch (ExecutionException | RuntimeException ex) {
                    if (connection == pending) {
                        MediaController.releaseFuture(pending);
                        connection = null;
                    }
                    call.reject("Servicio no disponible", ex);
                }
            }, main::post);
        });
    }

    @PluginMethod public void getState(PluginCall call) { connected(call, radio -> {}); }
    @PluginMethod public void play(PluginCall call) {
        connected(call, radio -> {
            if (radio.getCurrentMediaItem() == null) radio.setMediaItem(RadioService.station(0));
            radio.prepare();
            radio.play();
        });
    }
    @PluginMethod public void pause(PluginCall call) { connected(call, MediaController::pause); }
    @PluginMethod public void setVolume(PluginCall call) {
        float volume = call.getFloat("volume", 0.8f);
        connected(call, radio -> radio.setVolume(Math.min(1f, Math.max(0f, volume))));
    }

    @Override protected void handleOnDestroy() {
        main.post(() -> {
            destroyed = true;
            if (connection != null) MediaController.releaseFuture(connection);
        });
    }
}
