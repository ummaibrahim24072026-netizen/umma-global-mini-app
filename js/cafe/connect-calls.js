(() => {
  'use strict';

  const apiUrl = 'https://zwzojugspldexyyljwpr.supabase.co/functions/v1/cafe-connect-calls';
  const backupStun = 'stun:stun.cloudflare.com:3478';
  const turnUrl = /^turns?:/i;
  const hasCandidates = sdp => /^a=candidate:/m.test(sdp || '');
  const hasRelay = server => [server.urls].flat().some(url => turnUrl.test(url));
  const validId = value => typeof value === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(value);
  const icons = {
    audio: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 18 18 0 0 1-7.9-2.8 18 18 0 0 1-5.5-5.5A18 18 0 0 1 3.6 5.7 2 2 0 0 1 5.6 3.5h3a2 2 0 0 1 2 1.7l.4 2.5a2 2 0 0 1-.4 2l-1.3 1.3a14 14 0 0 0 5.5 5.5l1.3-1.3a2 2 0 0 1 2-.4l2.2.4a2 2 0 0 1 1.7 1.7Z"/>',
    video: '<rect x="3" y="5" width="13" height="14" rx="3"/><path d="m16 10 5-3v10l-5-3"/>'
  };
  const copy = {
    ru: {
      audio: 'Голосовой звонок', video: 'Видеозвонок', incoming: 'Входящий звонок', fromCafe: 'Звонит UMMA', fromClient: 'Звонит клиент', ringtone: 'Включить звук звонка', outgoing: 'Вызываем…',
      connecting: 'Подключаем…', connected: 'На связи', reconnecting: 'Восстанавливаем связь…',
      answer: 'Принять', decline: 'Отклонить', end: 'Завершить', close: 'Закрыть',
      speaker: 'Громкая связь', louder: 'Усилить звук', speakerSystem: 'Выберите динамик в системных настройках звука, если телефон поддерживает такой выбор.',
      flip: 'Сменить камеру', flipFailed: 'Не удалось сменить камеру.', cameraLost: 'Камера недоступна. Попробуйте переключить её ещё раз.',
      mute: 'Выключить микрофон', unmute: 'Включить микрофон', hide: 'Выключить камеру', show: 'Включить камеру',
      busy: 'Линия занята. Попробуйте чуть позже.', ended: 'Звонок завершён.',
      unanswered: 'На звонок не ответили.', expired: 'Этот вызов уже завершён.', unavailable: 'Не удалось установить связь. Попробуйте ещё раз.',
      denied: 'Разрешите этому сайту доступ к камере и микрофону в настройках браузера.',
      microphoneDenied: 'Разрешите этому сайту доступ к микрофону в настройках браузера.',
      cameraDenied: 'Разрешите этому сайту доступ к камере в настройках браузера.',
      microphoneUnavailable: 'Микрофон недоступен. Проверьте настройки телефона и закройте приложения, которые могут его использовать.',
      mediaUnavailable: 'Камера или микрофон недоступны. Проверьте настройки телефона и закройте приложения, которые могут их использовать.',
      networkUnavailable: 'Не удалось соединить устройства. Попробуйте другую сеть Wi‑Fi или мобильный интернет.',
      retry: 'Повторить', playback: 'Включить звук', client: 'Клиент'
    },
    en: {
      audio: 'Voice call', video: 'Video call', incoming: 'Incoming call', fromCafe: 'UMMA is calling', fromClient: 'A customer is calling', ringtone: 'Enable ringtone', outgoing: 'Calling…',
      connecting: 'Connecting…', connected: 'Connected', reconnecting: 'Reconnecting…',
      answer: 'Answer', decline: 'Decline', end: 'End call', close: 'Close',
      speaker: 'Speaker', louder: 'Boost volume', speakerSystem: 'Select the speaker in your device’s audio controls if available.',
      flip: 'Switch camera', flipFailed: 'Could not switch cameras.', cameraLost: 'Camera unavailable. Try switching it again.',
      mute: 'Mute microphone', unmute: 'Unmute microphone', hide: 'Turn camera off', show: 'Turn camera on',
      busy: 'Line busy. Try again shortly.', ended: 'Call ended.',
      unanswered: 'No answer.', expired: 'This call has already ended.', unavailable: 'Could not connect. Try again.',
      denied: 'Allow this site to use the camera and microphone in your browser settings.',
      microphoneDenied: 'Allow this site to use the microphone in your browser settings.',
      cameraDenied: 'Allow this site to use the camera in your browser settings.',
      microphoneUnavailable: 'Microphone unavailable. Check your device settings and close any app that may be using it.',
      mediaUnavailable: 'Camera or microphone unavailable. Check your device settings and close any app that may be using them.',
      networkUnavailable: 'Could not connect the devices. Try another Wi-Fi network or mobile data.',
      retry: 'Try again', playback: 'Play sound', client: 'Customer'
    },
    vi: {
      audio: 'Gọi thoại', video: 'Gọi video', incoming: 'Cuộc gọi đến', fromCafe: 'UMMA đang gọi', fromClient: 'Khách hàng đang gọi', ringtone: 'Bật nhạc chuông', outgoing: 'Đang gọi…',
      connecting: 'Đang kết nối…', connected: 'Đã kết nối', reconnecting: 'Đang kết nối lại…',
      answer: 'Trả lời', decline: 'Từ chối', end: 'Kết thúc', close: 'Đóng',
      speaker: 'Loa ngoài', louder: 'Tăng âm lượng', speakerSystem: 'Chọn loa ngoài trong phần cài đặt âm thanh của thiết bị nếu có.',
      flip: 'Đổi camera', flipFailed: 'Không đổi được camera.', cameraLost: 'Camera không khả dụng. Hãy thử đổi camera lại.',
      mute: 'Tắt micrô', unmute: 'Bật micrô', hide: 'Tắt camera', show: 'Bật camera',
      busy: 'Đường dây đang bận. Vui lòng thử lại sau.', ended: 'Cuộc gọi đã kết thúc.',
      unanswered: 'Không có trả lời.', expired: 'Cuộc gọi này đã kết thúc.', unavailable: 'Không thể kết nối. Vui lòng thử lại.',
      denied: 'Cho phép trang web dùng camera và micrô trong cài đặt trình duyệt.',
      microphoneDenied: 'Cho phép trang web dùng micrô trong cài đặt trình duyệt.',
      cameraDenied: 'Cho phép trang web dùng camera trong cài đặt trình duyệt.',
      microphoneUnavailable: 'Không dùng được micrô. Hãy kiểm tra cài đặt thiết bị và đóng ứng dụng có thể đang dùng micrô.',
      mediaUnavailable: 'Không dùng được camera hoặc micrô. Hãy kiểm tra cài đặt thiết bị và đóng ứng dụng có thể đang dùng chúng.',
      networkUnavailable: 'Không thể kết nối hai thiết bị. Hãy thử mạng Wi-Fi khác hoặc dữ liệu di động.',
      retry: 'Thử lại', playback: 'Bật âm thanh', client: 'Khách hàng'
    }
  };

  function element(tag, className) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    return node;
  }

  function listenForIce(peer, signal) {
    if (peer.iceGatheringState === 'complete' || signal.aborted) return Promise.resolve();
    return new Promise(resolve => {
      const finish = () => {
        clearTimeout(timer);
        peer.removeEventListener('icegatheringstatechange', onState);
        signal.removeEventListener('abort', finish);
        resolve();
      };
      const onState = () => { if (peer.iceGatheringState === 'complete') finish(); };
      // The signaling service exchanges complete SDP, so late relay candidates
      // would otherwise never reach the other browser.
      const timer = setTimeout(finish, 20000);
      peer.addEventListener('icegatheringstatechange', onState);
      signal.addEventListener('abort', finish, {once: true});
      onState();
    });
  }

  window.ummaConnectCalls = function ({identity, language, prepare}) {
    if (!window.RTCPeerConnection || !navigator.mediaDevices?.getUserMedia || !crypto.randomUUID) return null;
    const device = crypto.randomUUID();
    const t = key => (copy[language()] || copy.en)[key];
    let current, modal, pollTimer, ringAudio, iceCache, polling = false, pollAgain = false;
    const linkedId = new URL(location.href).searchParams.get('call');
    let requestedCall = validId(linkedId) ? linkedId : null;
    let pushedCall = null;

    function dismissNotification(id) {
      navigator.serviceWorker?.controller?.postMessage({type: 'UMMA_CLOSE_CALL', callId: id});
    }

    function consumeLink() {
      requestedCall = null;
      const url = new URL(location.href);
      if (!url.searchParams.has('call')) return;
      url.searchParams.delete('call');
      history.replaceState(history.state, '', url);
    }

    async function request(action, data = {}, credentials = identity(), keepalive = false) {
      if (!credentials) throw new Error('unavailable');
      const response = await fetch(apiUrl, {
        method: 'POST', cache: 'no-store', headers: {'Content-Type': 'application/json'},
        signal: keepalive ? undefined : AbortSignal.timeout?.(10000), keepalive,
        body: JSON.stringify({...credentials, action, device, ...data})
      });
      const result = await response.json();
      if (result.busy) throw new Error('busy');
      if (!response.ok || !result.ok) throw new Error('unavailable');
      return result;
    }

    async function getIceServers(call) {
      const account = call.credentials?.initData || call.credentials?.token;
      if (iceCache && iceCache.account === account && iceCache.until > Date.now()) return iceCache.servers;
      const {servers: configured} = await request('ice', {id: call.incoming ? call.id : null}, call.credentials);
      if (!Array.isArray(configured) || !configured.length) throw new Error('unavailable');
      const servers = configured.some(server => [server.urls].flat().includes(backupStun))
        ? configured : [...configured, {urls: backupStun}];
      if (servers.some(hasRelay)) {
        iceCache = {account, servers, until: Date.now() + 10 * 60 * 1000};
      }
      return servers;
    }

    function action(label, handler, className) {
      const button = element('button', className);
      button.type = 'button';
      button.textContent = t(label);
      button.setAttribute('aria-label', t(label));
      button.dataset.callAction = label;
      button.title = t(label);
      const iconPaths = {
        speaker: '<path d="M11 5 6 9H3v6h3l5 4V5ZM15 9a5 5 0 0 1 0 6M18 6a9 9 0 0 1 0 12"/>',
        flip: '<path d="M21 8V4m0 4h-4M3 16v4m0-4h4M20 7a9 9 0 0 0-15 1M4 17a9 9 0 0 0 15-1"/><rect x="8" y="9" width="8" height="6" rx="1.5"/>',
        mute: '<path d="M12 19v3m-5 0h10M9 9v3a3 3 0 0 0 5.1 2.1M15 9V6a3 3 0 0 0-6 0v1M5 10v2a7 7 0 0 0 12 4M3 3l18 18"/>',
        unmute: '<rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-5 0h10"/>',
        hide: '<rect x="3" y="5" width="13" height="14" rx="3"/><path d="m16 10 5-3v10l-5-3M3 3l18 18"/>',
        show: '<rect x="3" y="5" width="13" height="14" rx="3"/><path d="m16 10 5-3v10l-5-3"/>',
        end: '<path d="M3 15.5c5-5 13-5 18 0l-2.8 3.2-3.6-2.1v-2.1a12 12 0 0 0-5.2 0v2.1l-3.6 2.1Z"/>',
        decline: '<path d="M3 15.5c5-5 13-5 18 0l-2.8 3.2-3.6-2.1v-2.1a12 12 0 0 0-5.2 0v2.1l-3.6 2.1Z"/>',
        answer: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 18 18 0 0 1-7.9-2.8 18 18 0 0 1-5.5-5.5A18 18 0 0 1 3.6 5.7 2 2 0 0 1 5.6 3.5h3a2 2 0 0 1 2 1.7l.4 2.5a2 2 0 0 1-.4 2l-1.3 1.3a14 14 0 0 0 5.5 5.5l1.3-1.3a2 2 0 0 1 2-.4l2.2.4a2 2 0 0 1 1.7 1.7Z"/>'
      };
      if (iconPaths[label]) {
        button.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + iconPaths[label] + '</svg><span>' + t(label) + '</span>';
      }
      button.onclick = handler;
      return button;
    }

    function release(call) {
      clearTimeout(call.deadline);
      stopRinger(call);
      clearInterval(call.durationTimer);
      call.waveFrame && cancelAnimationFrame(call.waveFrame);
      call.waveAudio?.close().catch(() => {});
      call.waveAudio = null;
      call.iceGathering?.abort();
      call.peer?.close();
      call.stream?.getTracks().forEach(track => track.stop());
      if (call.remoteVideo) call.remoteVideo.srcObject = null;
      if (call.remoteAudio) call.remoteAudio.srcObject = null;
      void call.volumeContext?.close().catch(() => {});
      if (call.audioSession) {
        try { call.audioSession.type = call.previousAudioType; } catch {}
      }
      if (call.local) call.local.srcObject = null;
    }

    function signalEnd(call, keepalive) {
      if (call.credentials && (call.sent || call.incoming)) {
        void request('end', {id: call.id}, call.credentials, keepalive).catch(() => {});
      }
    }

    function finish(call, reason, notify = true, keepalive = false) {
      if (current !== call) return;
      current = null;
      if (!keepalive || notify) dismissNotification(call.id);
      release(call);
      if (notify) signalEnd(call, keepalive);
      if (!reason) {
        call.overlay?.close();
        return;
      }
      call.overlay.classList.remove('umma-call-incoming', 'umma-call-has-video');
      call.status.textContent = t(reason);
      call.duration.hidden = true;
      call.wave.hidden = true;
      call.media.hidden = true;
      call.playback?.remove();
      call.mediaNotice.textContent = '';
      call.controls.replaceChildren(action('close', () => call.overlay.close()));
      if (reason === 'networkUnavailable' && !call.incoming) {
        const {clientId, name} = call;
        call.controls.prepend(action('retry', () => start(call.mode, {clientId, name}), 'umma-call-answer'));
      }
    }

    function startWave(call, stream) {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio || !call.wave || !stream.getAudioTracks().length) return;
      try {
        const ctx = call.waveAudio = new Audio();
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        analyser.smoothingTimeConstant = .78;
        source.connect(analyser); // Never connect the microphone to speakers.
        const samples = new Uint8Array(analyser.frequencyBinCount);
        const bars = [...call.wave.children];
        const draw = () => {
          if (current !== call || ctx.state === 'closed') return;
          analyser.getByteFrequencyData(samples);
          const active = stream.getAudioTracks()[0]?.enabled;
          bars.forEach((bar, index) => {
            const band = Math.floor(index / bars.length * (samples.length * .65));
            const value = active ? samples[band] / 255 : 0;
            bar.style.transform = 'scaleY(' + Math.max(.12, Math.min(1.5, .18 + value * 2.6)) + ')';
          });
          call.waveFrame = requestAnimationFrame(draw);
        };
        void ctx.resume().catch(() => {});
        draw();
      } catch { call.waveAudio?.close().catch(() => {}); }
    }

    function toggleTrack(getTrack, off, on, update) {
      const button = action(off, () => {
        const track = getTrack();
        if (track?.readyState !== 'live') return;
        track.enabled = !track.enabled;
        update?.(track.enabled);
        button.title = t(track.enabled ? off : on);
        button.setAttribute('aria-label', t(track.enabled ? off : on));
        button.querySelector('span')?.replaceChildren(document.createTextNode(t(track.enabled ? off : on)));
        button.setAttribute('aria-pressed', String(!track.enabled));
      });
      button.setAttribute('aria-pressed', 'false');
      return button;
    }

    async function enableRinger() {
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) return;
      try {
        ringAudio ||= new Audio();
        if (ringAudio.state !== 'running') await ringAudio.resume();
      } catch {}
    }

    function stopRinger(call) {
      clearInterval(call.ringer);
      clearInterval(call.ringbackTimer);
      if (call.ringer) navigator.vibrate?.(0);
      call.ringer = null;
      for (const note of call.notes || []) note.stop();
      call.notes?.clear();
      call.ringtoneButton?.remove();
    }

    function ringback(call) {
      if (!ringAudio || call.incoming) return;
      call.notes ||= new Set();
      const tone = () => {
        if (current !== call || call.connected || ringAudio.state !== 'running') return;
        const now = ringAudio.currentTime;
        const osc = ringAudio.createOscillator();
        const gain = ringAudio.createGain();
        osc.frequency.value = 425;
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.18, now + 0.03);
        gain.gain.setValueAtTime(0.18, now + 0.65);
        gain.gain.linearRampToValueAtTime(0, now + 0.75);
        osc.connect(gain).connect(ringAudio.destination);
        call.notes.add(osc);
        osc.onended = () => {
          call.notes.delete(osc);
          osc.disconnect();
          gain.disconnect();
        };
        osc.start(now);
        osc.stop(now + 0.75);
      };
      tone();
      call.ringbackTimer = setInterval(tone, 2600);
    }

    function ring(call) {
      if (current !== call || document.hidden) return;
      navigator.vibrate?.([240, 120, 240]);
      if (ringAudio?.state !== 'running' || call.notes.size) return;
      call.ringtoneButton?.remove();
      for (const [offset, frequency] of [[0, 660], [0.24, 880], [0.48, 660]]) {
        const time = ringAudio.currentTime + offset;
        const oscillator = ringAudio.createOscillator();
        const gain = ringAudio.createGain();
        oscillator.frequency.value = frequency;
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(0.32, time + 0.03);
        gain.gain.linearRampToValueAtTime(0, time + 0.19);
        oscillator.connect(gain).connect(ringAudio.destination);
        call.notes.add(oscillator);
        oscillator.onended = () => {
          call.notes.delete(oscillator);
          oscillator.disconnect();
          gain.disconnect();
        };
        oscillator.start(time);
        oscillator.stop(time + 0.19);
      }
    }

    function show(call) {
      const existing = modal;
      if (existing?.open) existing.close();
      modal = element('dialog', 'umma-call');
      const opened = modal;
      opened.setAttribute('aria-label', t(call.mode));
      const card = element('section', 'umma-call-card');
      const identity = element('div', 'umma-call-identity');
      const title = element('h2');
      const isStaff = Boolean(call.credentials?.initData);
      title.textContent = call.name || (isStaff ? t('client') : 'UMMA');
      if (call.incoming) opened.classList.add('umma-call-incoming');
      if (call.mode === 'video') opened.classList.add('umma-call-video');
      const type = element('p', 'umma-call-type');
      type.textContent = t(call.mode);
      call.status = element('p', 'umma-call-status');
      call.status.setAttribute('role', 'status');
      call.status.textContent = t(call.incoming ? 'incoming' : 'connecting');
      call.duration = element('p', 'umma-call-duration');
      call.duration.hidden = true;
      call.media = element('div', 'umma-call-media');
      call.media.hidden = true;
      call.controls = element('div', 'umma-call-controls');
      call.mediaNotice = element('p', 'umma-call-media-notice');
      call.mediaNotice.setAttribute('role', 'status');
      const footer = element('div', 'umma-call-footer');
      footer.append(call.mediaNotice, call.controls);
      const cancel = () => finish(call);
      if (call.incoming) {
        call.controls.append(action('decline', cancel, 'umma-call-end'),
          action('answer', () => {
            void enableRinger();
            void establish(call);
          }, 'umma-call-answer'));
      } else {
        call.controls.append(action('end', cancel, 'umma-call-end'));
      }
      call.wave = element('div', 'umma-call-wave');
      call.wave.setAttribute('aria-hidden', 'true');
      for (let i = 0; i < 25; i++) {
        const bar = element('i');
        bar.style.height = (12 + 76 * Math.pow(Math.max(0, 1 - Math.abs(i - 12) / 13), 2)) + '%';
        call.wave.append(bar);
      }
      call.overlay = opened;
      identity.append(title, type, call.status, call.duration, call.wave);
      card.append(identity, call.media, footer);
      opened.append(card);
      opened.addEventListener('cancel', event => {
        event.preventDefault();
        if (current === call) cancel();
        else opened.close();
      });
      opened.addEventListener('close', () => {
        if (current === call) finish(call);
        opened.remove();
        if (modal === opened) modal = null;
      });
      document.body.append(opened);
      opened.showModal();

      if (call.incoming) {
        call.notes = new Set();
        if (ringAudio?.state !== 'running' && (window.AudioContext || window.webkitAudioContext)) {
          call.ringtoneButton = action('ringtone', async () => {
            await enableRinger();
            if (call.ringer) ring(call);
          }, 'umma-call-ring-button');
          call.controls.append(call.ringtoneButton);
        }
        ring(call);
        call.ringer = setInterval(() => ring(call), 2100);
      }
    }

    function armTimeout(call, key, ms, notify = true) {
      clearTimeout(call.deadline);
      call.deadline = setTimeout(() => finish(call, key, notify), ms);
    }

    async function mediaProblem(mode, error) {
      if (['NotAllowedError', 'PermissionDeniedError', 'SecurityError'].includes(error.name)) {
        if (mode === 'audio') return 'microphoneDenied';
        const permissions = await Promise.all(['microphone', 'camera'].map(async name => {
          try { return (await navigator.permissions?.query({name}))?.state; }
          catch { return null; }
        }));
        const [microphone, camera] = permissions;
        if (camera === 'denied' && microphone !== 'denied') return 'cameraDenied';
        if (microphone === 'denied' && camera !== 'denied') return 'microphoneDenied';
        return 'denied';
      }
      return mode === 'audio' ? 'microphoneUnavailable' : 'mediaUnavailable';
    }

    function cameraConstraints(facingMode) {
      return {facingMode, width: {ideal: 640}, height: {ideal: 480}};
    }

    function previewCamera(call, track) {
      call.local.classList.toggle('umma-call-preview-mirrored', call.facing === 'user');
      call.local.srcObject = new MediaStream([track]);
      call.local.hidden = !track.enabled;
      void call.local.play().catch(() => {});
    }

    async function replaceCamera(call, facing, constraints) {
      const capture = await navigator.mediaDevices.getUserMedia({audio: false, video: constraints});
      const track = capture.getVideoTracks()[0];
      try {
        if (current !== call) return;
        if (!track) throw new Error('Camera unavailable');
        track.enabled = call.cameraEnabled;
        await call.videoSender.replaceTrack(track);
        if (current !== call) return;
        for (const old of call.stream.getVideoTracks()) {
          old.stop();
          call.stream.removeTrack(old);
        }
        call.stream.addTrack(track);
        call.facing = track.getSettings().facingMode || facing;
        previewCamera(call, track);
      } finally {
        for (const captured of capture.getTracks()) {
          if (current !== call || !call.stream.getTracks().includes(captured)) captured.stop();
        }
      }
    }

    async function switchCamera(call, button, cameraToggle) {
      if (current !== call || button.disabled) return;
      button.disabled = cameraToggle.disabled = true;
      call.mediaNotice.textContent = '';
      const old = call.stream.getVideoTracks()[0];
      const previous = old?.getSettings().deviceId;
      const facing = call.facing === 'user' ? 'environment' : 'user';
      const constraints = cameraConstraints({exact: facing});
      try {
        try {
          await replaceCamera(call, facing, constraints);
        } catch (error) {
          if (current !== call) return;
          // Some mobile devices cannot open two cameras at once.
          if (old?.readyState !== 'live' || !['NotReadableError', 'AbortError'].includes(error.name)) throw error;
          old.stop();
          call.local.hidden = true;
          await replaceCamera(call, facing, constraints);
        }
      } catch {
        if (current !== call) return;
        call.mediaNotice.textContent = t('flipFailed');
        if (old?.readyState === 'live' && !old.muted) return;
        old?.stop();
        call.local.hidden = true;
        try {
          const restore = cameraConstraints({ideal: call.facing});
          if (previous) restore.deviceId = {exact: previous};
          await replaceCamera(call, call.facing, restore);
        } catch {
          if (current === call) {
            if (old) call.stream.removeTrack(old);
            call.mediaNotice.textContent = t('cameraLost');
          }
        }
      } finally {
        button.disabled = false;
        cameraToggle.disabled = !call.stream.getVideoTracks().some(track => track.readyState === 'live');
      }
    }

    function setupRemoteMedia(call, peer) {
      const audio = call.remoteAudio = element('audio');
      audio.autoplay = true;
      audio.volume = 1;
      call.media.prepend(audio);
      call.media.hidden = false;
      const playback = call.playback = action('playback', () => void playAudio());
      playback.hidden = true;
      const playAudio = async () => {
        if (current !== call || !audio.srcObject) return;
        try {
          await audio.play();
          if (current === call) playback.hidden = true;
        } catch {
          if (current === call) playback.hidden = false;
        }
      };
      const Audio = window.AudioContext || window.webkitAudioContext;
      let useBoost = typeof audio.setSinkId !== 'function' && Boolean(Audio);
      const updateSpeaker = active => {
        const label = t(useBoost ? 'louder' : 'speaker');
        speaker.title = label;
        speaker.setAttribute('aria-label', label);
        speaker.querySelector('span').textContent = label;
        speaker.setAttribute('aria-pressed', String(active));
      };
      const boostVolume = async () => {
        if (!Audio || !audio.srcObject) return false;
        if (call.volumeContext) {
          const context = call.volumeContext;
          call.volumeContext = null;
          audio.muted = false;
          await context.close().catch(() => {});
          updateSpeaker(false);
          return true;
        }
        const context = call.volumeContext = new Audio();
        try {
          const source = context.createMediaStreamSource(audio.srcObject);
          const gain = context.createGain();
          gain.gain.value = 1.6;
          const compressor = context.createDynamicsCompressor();
          compressor.threshold.value = -6;
          compressor.ratio.value = 8;
          await context.resume();
          if (current !== call) return false;
          if (context.state !== 'running') throw new Error('Volume boost unavailable');
          source.connect(gain).connect(compressor).connect(context.destination);
          audio.muted = true;
          updateSpeaker(true);
          context.addEventListener('statechange', () => {
            if (current !== call || call.volumeContext !== context) return;
            const running = context.state === 'running';
            audio.muted = running;
            updateSpeaker(running);
            if (!running) void playAudio();
          });
          return true;
        } catch {
          call.volumeContext = null;
          await context.close().catch(() => {});
          return false;
        }
      };
      const speaker = action('speaker', async () => {
        const devices = navigator.mediaDevices;
        speaker.disabled = true;
        call.mediaNotice.textContent = '';
        try {
          if (useBoost) {
            if (!await boostVolume() && current === call) call.mediaNotice.textContent = t('speakerSystem');
            return;
          }
          if (typeof audio.setSinkId !== 'function') throw new Error('Audio routing unavailable');
          if (audio.sinkId) {
            await audio.setSinkId('');
          } else if (devices.selectAudioOutput) {
            const output = await devices.selectAudioOutput();
            if (current !== call) return;
            await audio.setSinkId(output.deviceId);
          } else {
            const outputs = await devices.enumerateDevices();
            if (current !== call) return;
            const output = outputs.find(device => device.kind === 'audiooutput' && device.deviceId &&
              !['default', 'communications'].includes(device.deviceId) &&
              /built-in speaker|speakerphone|loudspeaker|loa ngoài|громкая связь|^speakers?\b/i.test(device.label));
            if (!output) throw new Error('Speaker unavailable');
            await audio.setSinkId(output.deviceId);
          }
          if (current === call) updateSpeaker(Boolean(audio.sinkId));
        } catch (error) {
          if (current !== call || error?.name === 'AbortError') return;
          if (Audio && !audio.sinkId) {
            useBoost = true;
            updateSpeaker(false);
            if (await boostVolume()) return;
          }
          if (current === call) call.mediaNotice.textContent = t('speakerSystem');
        } finally {
          speaker.disabled = false;
          void playAudio();
        }
      });
      updateSpeaker(false);
      speaker.disabled = true;
      call.controls.prepend(speaker);
      playback.className = 'umma-call-playback';
      call.controls.before(playback);

      let video;
      if (call.mode === 'video') {
        video = call.remoteVideo = element('video');
        video.autoplay = true;
        video.muted = true;
        video.playsInline = true;
        video.hidden = true;
        call.media.prepend(video);
      }
      peer.ontrack = ({track}) => {
        if (current !== call) return;
        if (track.kind === 'audio') {
          audio.srcObject = new MediaStream([track]);
          speaker.disabled = false;
          track.addEventListener('unmute', playAudio);
          void playAudio();
        } else if (video) {
          video.srcObject = new MediaStream([track]);
          const updateVideo = () => {
            if (current !== call) return;
            const visible = !track.muted && track.readyState === 'live';
            video.hidden = !visible;
            if (visible) void video.play().catch(() => {});
          };
          for (const event of ['unmute', 'mute', 'ended']) track.addEventListener(event, updateVideo);
          updateVideo();
        }
      };
      return playAudio;
    }

    async function establish(call) {
      stopRinger(call);
      armTimeout(call, 'unavailable', 50000);
      call.overlay.classList.remove('umma-call-incoming');
      dismissNotification(call.id);
      call.status.textContent = t('connecting');
      const end = action('end', () => finish(call), 'umma-call-end');
      call.controls.replaceChildren(end);
      let stream;
      call.mediaNotice.textContent = '';
      if (!call.audioSession && navigator.audioSession) {
        try {
          const session = navigator.audioSession;
          call.previousAudioType = session.type;
          session.type = 'play-and-record';
          call.audioSession = session;
        } catch {}
      }
      try {
        // Request media directly in the click handler, including for first-time guests.
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {echoCancellation: true, noiseSuppression: true},
          video: call.mode === 'video' && cameraConstraints({ideal: 'user'})
        });
        if (!stream.getAudioTracks().length || (call.mode === 'video' && !stream.getVideoTracks().length)) {
          throw new DOMException('', 'NotFoundError');
        }
      } catch (error) {
        stream?.getTracks().forEach(track => track.stop());
        const reason = await mediaProblem(call.mode, error);
        if (current !== call) return;
        clearTimeout(call.deadline);
        if (call.incoming) {
          armTimeout(call, 'unanswered', 75000, false);
          call.status.textContent = t(reason);
          call.controls.prepend(action('retry', () => void establish(call), 'umma-call-answer'));
        } else {
          finish(call, reason);
          const {clientId, name} = call;
          call.controls.prepend(action('retry', () => start(call.mode, {clientId, name}), 'umma-call-answer'));
        }
        return;
      }
      if (current !== call) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      call.stream = stream;
      try {
        const microphone = stream.getAudioTracks()[0];
        const camera = stream.getVideoTracks()[0];
        startWave(call, stream);
        call.controls.prepend(toggleTrack(() => microphone, 'mute', 'unmute'));
        if (camera) {
          const local = call.local = element('video', 'umma-call-preview');
          local.muted = true;
          local.autoplay = true;
          local.playsInline = true;
          call.facing = camera.getSettings().facingMode || 'user';
          call.cameraEnabled = camera.enabled;
          call.media.append(local);
          call.media.hidden = false;
          call.overlay.classList.add('umma-call-has-video');
          previewCamera(call, camera);
        }
        if (!call.credentials && prepare) {
          await prepare();
          if (current !== call) return;
          call.credentials = identity();
        }
        const servers = await getIceServers(call);
        if (current !== call) return;
        const peer = call.peer = new RTCPeerConnection({iceServers: servers});
        call.iceGathering = new AbortController();
        const playAudio = setupRemoteMedia(call, peer);
        peer.addTrack(microphone, stream);
        if (camera) {
          call.videoSender = peer.addTrack(camera, stream);
          const cameraToggle = toggleTrack(() => stream.getVideoTracks()[0], 'hide', 'show', enabled => {
            call.cameraEnabled = enabled;
            call.local.hidden = !enabled;
          });
          const flip = action('flip', () => void switchCamera(call, flip, cameraToggle));
          call.controls.prepend(cameraToggle, flip);
        }
        peer.onconnectionstatechange = () => {
          if (current !== call) return;
          const state = peer.connectionState;
          if (state === 'connected') {
            clearTimeout(call.deadline);
            stopRinger(call);
            call.connected = true;
            void playAudio();
            call.status.textContent = t('connected');
            if (!call.durationTimer) {
              const started = Date.now();
              const tick = () => {
                const seconds = Math.floor((Date.now() - started) / 1000);
                call.duration.textContent = [Math.floor(seconds / 60), seconds % 60]
                  .map(part => String(part).padStart(2, '0')).join(':');
              };
              call.duration.hidden = false;
              tick();
              call.durationTimer = setInterval(tick, 1000);
            }
          } else if (state === 'disconnected' && call.connected) {
            call.status.textContent = t('reconnecting');
            armTimeout(call, 'networkUnavailable', 25000);
          } else if (state === 'failed') {
            finish(call, 'networkUnavailable');
          }
        };
        if (call.incoming) await peer.setRemoteDescription({type: 'offer', sdp: call.offer});
        await peer.setLocalDescription(call.incoming ? await peer.createAnswer() : await peer.createOffer());
        await listenForIce(peer, call.iceGathering.signal);
        if (current !== call) return;
        const sdp = peer.localDescription?.sdp;
        if (!hasCandidates(sdp)) {
          finish(call, 'networkUnavailable');
          return;
        }
        call.sent = true;
        const description = {id: call.id, clientId: call.clientId, mode: call.mode, sdp};
        let result;
        try {
          result = await request(call.incoming ? 'answer' : 'start', description, call.credentials);
        } catch (error) {
          if (current !== call || error.message === 'busy') throw error;
          // A lost HTTP response does not mean the offer or answer was lost.
          result = await request('poll', {id: call.id}, call.credentials);
          if (!result.call || (call.incoming && result.call.offer !== null)) throw error;
        }
        if (current !== call) {
          // The first cancellation may have reached the server before this request.
          signalEnd(call);
          return;
        }
        if (!result.call) {
          finish(call, 'ended', false);
          return;
        }
        call.ready = true;
        if (!call.incoming) {
          call.status.textContent = t('outgoing');
          ringback(call);
          armTimeout(call, 'unanswered', 74000);
        } else if (!call.connected) {
          armTimeout(call, 'networkUnavailable', 25000);
        }
        schedule(0);
      } catch (error) {
        finish(call, error.message === 'busy' ? 'busy' : 'unavailable');
      }
    }

    function start(mode, target) {
      if (current) return;
      void enableRinger();
      current = {id: crypto.randomUUID(), mode, ...target, credentials: identity()};
      show(current);
      void establish(current);
    }

    function schedule(delay) {
      if (polling) {
        if (delay === 0) pollAgain = true;
        return;
      }
      clearTimeout(pollTimer);
      pollTimer = setTimeout(poll, delay);
    }

    async function poll() {
      if (polling) return;
      polling = true;
      const call = current;
      // An outgoing request is not visible until the offer has been posted.
      const activeIdentity = identity();
      const credentials = call?.credentials || activeIdentity;
      try {
        if (call?.credentials && (!activeIdentity ||
            activeIdentity.token !== credentials.token || activeIdentity.initData !== credentials.initData)) {
          finish(call, 'ended');
          return;
        }
        if ((!call && document.hidden) || !credentials || (call && !call.ready && !call.incoming)) return;
        const linked = !call ? requestedCall : null;
        const hinted = !call && !linked ? pushedCall : null;
        let {call: state} = await request('poll', {id: call?.id || linked || hinted}, credentials);
        if (hinted && !state && current === call) {
          dismissNotification(hinted);
          ({call: state} = await request('poll', {}, credentials));
        }
        if (hinted && pushedCall === hinted) pushedCall = null;
        if (current !== call) return;
        if (linked && requestedCall !== linked) return;
        if (linked) consumeLink();
        if (!call && state?.incoming && state.offer) {
          current = {...state, credentials};
          show(current);
          if(document.body.dataset.workspace==='pos')window.ummaCounterSpeakAlert?.('Внимание! Вам звонит клиент.');
          armTimeout(current, 'unanswered', 75000, false);
        } else if (linked && !call) {
          current = {id: linked, mode: 'audio', credentials};
          show(current);
          finish(current, 'expired', false);
        } else if (call && !state) {
          finish(call, call.ready && !call.incoming && !call.peer?.remoteDescription ? 'unanswered' : 'ended', false);
        } else if (call?.ready && !call.incoming && state?.answer && !call.peer.remoteDescription) {
          stopRinger(call);
          if (!hasCandidates(state.answer)) {
            finish(call, 'networkUnavailable');
            return;
          }
          call.status.textContent = t('connecting');
          armTimeout(call, 'networkUnavailable', 25000);
          try {
            await call.peer.setRemoteDescription({type: 'answer', sdp: state.answer});
          } catch {
            finish(call, 'unavailable');
          }
        }
      } catch {
        // Signaling and media use different connections. A failed heartbeat
        // must not end a conversation whose media is still connected.
      } finally {
        polling = false;
        const delay = pollAgain ? 0 : current?.connected ? 3500 : current ? 1100 : 3000;
        pollAgain = false;
        schedule(delay);
      }
    }

    navigator.serviceWorker?.addEventListener('message', event => {
      const data = event.data;
      if (data?.type === 'UMMA_OPEN_CALL' && validId(data.callId) && current?.id !== data.callId) {
        requestedCall = data.callId;
      }
      if (data?.type === 'UMMA_CALL_PUSH' && validId(data.callId) && current?.id !== data.callId) {
        pushedCall = data.callId;
      }
      if (data?.type === 'UMMA_OPEN_CALL' || data?.type === 'UMMA_CALL_PUSH') schedule(0);
    });
    document.addEventListener('umma:staff-ready', () => schedule(0));
    document.addEventListener('click', enableRinger, {once: true, capture: true});
    document.addEventListener('visibilitychange', () => { if (!document.hidden) schedule(0); });
    window.addEventListener('online', () => schedule(0));
    window.addEventListener('pageshow', () => schedule(0));
    window.addEventListener('pagehide', () => {
      const call = current;
      if (call) finish(call, null, !call.incoming || Boolean(call.sent), true);
    });
    schedule(0);

    return {
      saveStaffSubscription(subscription) {
        return request('staffSubscription', {subscription});
      },
      buttons(target = () => ({})) {
        const group = element('div', 'umma-call-buttons');
        for (const mode of ['audio', 'video']) {
          const button = action(mode, () => start(mode, target()));
          button.setAttribute('aria-label', t(mode));
          button.title = t(mode);
          button.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + icons[mode] + '</svg>';
          group.append(button);
        }
        return group;
      }
    };
  };
})();
