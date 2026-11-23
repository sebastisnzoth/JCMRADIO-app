package com.app.jcmradiorock;

import android.os.Handler;
import android.os.Looper;
import androidx.media3.common.AudioAttributes;
import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MediaMetadata;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.session.MediaSession;
import androidx.media3.session.MediaSessionService;

public class RadioService extends MediaSessionService {
    private static final String[] STREAMS = {
        "https://sp.aljania.com/8120/stream", "https://sp.aljania.com:8120/stream"
    };
    private final Handler handler = new Handler(Looper.getMainLooper());
    private ExoPlayer player;
    private MediaSession session;
    private int failures;
    private final Runnable retry = () -> {
        if (player.getPlayWhenReady()) {
            player.setMediaItem(station(failures % STREAMS.length));
            player.prepare();
        }
    };

    static MediaItem station(int index) {
        return new MediaItem.Builder().setMediaId("jcm-live").setUri(STREAMS[index])
            .setMediaMetadata(new MediaMetadata.Builder().setTitle("JCM Radio en vivo").build())
            .build();
    }

    private void scheduleRetry() {
        handler.removeCallbacks(retry);
        if (player.getPlayWhenReady()) {
            failures++;
            handler.postDelayed(retry, 1000L << Math.min(5, failures));
        }
    }

    @Override
    public void onCreate() {
        super.onCreate();
        player = new ExoPlayer.Builder(this)
            .setAudioAttributes(AudioAttributes.DEFAULT, true)
            .setHandleAudioBecomingNoisy(true)
            .setWakeMode(C.WAKE_MODE_NETWORK)
            .build();
        player.addListener(new Player.Listener() {
            @Override public void onPlayerError(PlaybackException error) { scheduleRetry(); }
            @Override public void onPlaybackStateChanged(int state) {
                if (state == Player.STATE_ENDED) scheduleRetry();
                if (state == Player.STATE_READY) failures = 0;
            }
            @Override public void onPlayWhenReadyChanged(boolean play, int reason) {
                if (!play) {
                    handler.removeCallbacks(retry);
                    player.stop();
                    stopSelf();
                }
            }
        });
        session = new MediaSession.Builder(this, player).build();
    }

    @Override public MediaSession onGetSession(MediaSession.ControllerInfo controller) {
        return session;
    }

    @Override public void onDestroy() {
        handler.removeCallbacks(retry);
        session.release();
        player.release();
        super.onDestroy();
    }
}
