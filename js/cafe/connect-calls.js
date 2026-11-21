(() => {
  'use strict';

  const apiUrl = 'https://zwzojugspldexyyljwpr.supabase.co/functions/v1/cafe-connect-calls';
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
      speaker: 'Громкая связь', earpiece: 'Динамик телефона',
      mute: 'Выключить микрофон', unmute: 'Включить микрофон', hide: 'Выключить камеру', show: 'Включить камеру',
      busy: 'Линия занята. Попробуйте чуть позже.', ended: 'Звонок завершён.',
      unanswered: 'На звонок не ответили.', expired: 'Этот вызов уже завершён.', unavailable: 'Не удалось установить связь. Попробуйте ещё раз.',
      denied: 'Разрешите этому сайту доступ к камере и микрофону в настройках браузера.',
      microphoneDenied: 'Разрешите этому сайту доступ к микрофону в настройках браузера.',
      cameraDenied: 'Разрешите этому сайту доступ к камере в настройках браузера.',
      microphoneUnavailable: 'Микрофон недоступен. Проверьте настройки телефона и закройте приложения, которые могут его использовать.',
      mediaUnavailable: 'Камера или микрофон недоступны. Проверьте настройки телефона и закройте приложения, которые могут их использовать.',
      retry: 'Повторить', playback: 'Включить звук', client: 'Клиент'
    },
    en: {
      audio: 'Voice call', video: 'Video call', incoming: 'Incoming call', fromCafe: 'UMMA is calling', fromClient: 'A customer is calling', ringtone: 'Enable ringtone', outgoing: 'Calling…',
      connecting: 'Connecting…', connected: 'Connected', reconnecting: 'Reconnecting…',
      answer: 'Answer', decline: 'Decline', end: 'End call', close: 'Close',
      speaker: 'Speaker', earpiece: 'Phone earpiece',
      mute: 'Mute microphone', unmute: 'Unmute microphone', hide: 'Turn camera off', show: 'Turn camera on',
      busy: 'Line busy. Try again shortly.', ended: 'Call ended.',
      unanswered: 'No answer.', expired: 'This call has already ended.', unavailable: 'Could not connect. Try again.',
      denied: 'Allow this site to use the camera and microphone in your browser settings.',
      microphoneDenied: 'Allow this site to use the microphone in your browser settings.',
      cameraDenied: 'Allow this site to use the camera in your browser settings.',
      microphoneUnavailable: 'Microphone unavailable. Check your device settings and close any app that may be using it.',
      mediaUnavailable: 'Camera or microphone unavailable. Check your device settings and close any app that may be using them.',
      retry: 'Try again', playback: 'Play sound', client: 'Customer'
    },
    vi: {
      audio: 'Gọi thoại', video: 'Gọi video', incoming: 'Cuộc gọi đến', fromCafe: 'UMMA đang gọi', fromClient: 'Khách hàng đang gọi', ringtone: 'Bật nhạc chuông', outgoing: 'Đang gọi…',
      connecting: 'Đang kết nối…', connected: 'Đã kết nối', reconnecting: 'Đang kết nối lại…',
      answer: 'Trả lời', decline: 'Từ chối', end: 'Kết thúc', close: 'Đóng',
      speaker: 'Loa ngoài', earpiece: 'Loa thoại',
      mute: 'Tắt micrô', unmute: 'Bật micrô', hide: 'Tắt camera', show: 'Bật camera',
      busy: 'Đường dây đang bận. Vui lòng thử lại sau.', ended: 'Cuộc gọi đã kết thúc.',
      unanswered: 'Không có trả lời.', expired: 'Cuộc gọi này đã kết thúc.', unavailable: 'Không thể kết nối. Vui lòng thử lại.',
      denied: 'Cho phép trang web dùng camera và micrô trong cài đặt trình duyệt.',
      microphoneDenied: 'Cho phép trang web dùng micrô trong cài đặt trình duyệt.',
      cameraDenied: 'Cho phép trang web dùng camera trong cài đặt trình duyệt.',
      microphoneUnavailable: 'Không dùng được micrô. Hãy kiểm tra cài đặt thiết bị và đóng ứng dụng có thể đang dùng micrô.',
      mediaUnavailable: 'Không dùng được camera hoặc micrô. Hãy kiểm tra cài đặt thiết bị và đóng ứng dụng có thể đang dùng chúng.',
      retry: 'Thử lại', playback: 'Bật âm thanh', client: 'Khách hàng'
    }
  };

  function element(tag, className) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    return node;
  }

  function listenForIce(peer) {
    if (peer.iceGatheringState === 'complete') return Promise.resolve();
    return new Promise(resolve => {
      const finish = () => {
        clearTimeout(timer);
        peer.removeEventListener('icegatheringstatechange', onState);
        resolve();
      };
      const onState = () => { if (peer.iceGatheringState === 'complete') finish(); };
      const timer = setTimeout(finish, 8000);
      peer.addEventListener('icegatheringstatechange', onState);
    });
  }

  window.ummaConnectCalls = function ({identity, language, prepare}) {
    if (!window.RTCPeerConnection || !navigator.mediaDevices?.getUserMedia || !crypto.randomUUID) return null;
    const device = crypto.randomUUID();
    const t = key => (copy[language()] || copy.en)[key];
    let current, modal, pollTimer, ringAudio, polling = false, pollFailures = 0;
    const linkedId = new URL(location.href).searchParams.get('call');
    let requestedCall = validId(linkedId) ? linkedId : null;

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

    function action(label, handler, className) {
      const button = element('button', className);
      button.type = 'button';
      button.textContent = t(label);
      button.setAttribute('aria-label', t(label));
      button.dataset.callAction = label;
      button.title = t(label);
      const iconPaths = {
        speaker: '<path d="M11 5 6 9H3v6h3l5 4V5ZM15 9a5 5 0 0 1 0 6M18 6a9 9 0 0 1 0 12"/>',
        earpiece: '<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>',
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
      call.peer?.close();
      call.stream?.getTracks().forEach(track => track.stop());
      if (call.remote) call.remote.srcObject = null;
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
      dismissNotification(call.id);
      release(call);
      if (notify) signalEnd(call, keepalive);
      if (!reason) {
        modal?.close();
        return;
      }
      modal?.classList.remove('umma-call-incoming', 'umma-call-has-video');
      call.status.textContent = t(reason);
      call.duration.hidden = true;
      call.wave.hidden = true;
      call.media.hidden = true;
      call.controls.replaceChildren(action('close', () => modal.close()));
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

    function toggleTrack(track, off, on, update) {
      const button = action(off, () => {
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
      card.append(identity, call.media, call.controls);
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

    function armTimeout(call, key, ms) {
      clearTimeout(call.deadline);
      call.deadline = setTimeout(() => finish(call, key), ms);
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

    async function establish(call) {
      stopRinger(call);
      call.overlay.classList.remove('umma-call-incoming');
      dismissNotification(call.id);
      call.status.textContent = t('connecting');
      const end = action('end', () => finish(call), 'umma-call-end');
      call.controls.replaceChildren(end);
      let stream;
      try {
        // Request media directly in the click handler, including for first-time guests.
        stream = await navigator.mediaDevices.getUserMedia({
          audio: {echoCancellation: true, noiseSuppression: true},
          video: call.mode === 'video' && {facingMode: 'user', width: {ideal: 640}, height: {ideal: 480}}
        });
        if (!stream.getAudioTracks().length || (call.mode === 'video' && !stream.getVideoTracks().length)) {
          throw new DOMException('', 'NotFoundError');
        }
      } catch (error) {
        stream?.getTracks().forEach(track => track.stop());
        const reason = await mediaProblem(call.mode, error);
        if (current !== call) return;
        if (call.incoming) {
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
        call.controls.prepend(toggleTrack(microphone, 'mute', 'unmute'));
        if (camera) {
          const local = call.local = element('video', 'umma-call-preview');
          local.muted = true;
          local.autoplay = true;
          local.playsInline = true;
          local.srcObject = stream;
          call.media.append(local);
          call.media.hidden = false;
          void local.play().catch(() => {});
          call.controls.prepend(toggleTrack(camera, 'hide', 'show', enabled => { local.hidden = !enabled; }));
        }
        if (!call.credentials && prepare) {
          await prepare();
          if (current !== call) return;
          call.credentials = identity();
        }
        const {servers} = await request('ice', {id: call.incoming ? call.id : null}, call.credentials);
        if (current !== call) return;
        const peer = call.peer = new RTCPeerConnection({iceServers: servers});
        const remote = call.remote = element(call.mode === 'video' ? 'video' : 'audio');
        remote.autoplay = true;
        remote.playsInline = true;
        remote.hidden = true;
        call.media.prepend(remote);
        const playback = action('playback', () => {
          void remote.play().then(() => { playback.hidden = true; }).catch(() => {});
        });
        playback.hidden = true;
        call.controls.prepend(playback);
        // Output-device routing is browser-dependent. Only show a real switch when
        // the browser exposes both a communications output and the default output.
        if (typeof remote.setSinkId === 'function' && navigator.mediaDevices?.enumerateDevices) {
          void navigator.mediaDevices.enumerateDevices().then(devices => {
            if (current !== call) return;
            const outputs = devices.filter(device => device.kind === 'audiooutput');
            const handset = outputs.find(device => device.deviceId === 'communications' ||
              /earpiece|receiver|handset|разговорн/i.test(device.label));
            const speaker = outputs.find(device => device.deviceId === 'default' ||
              /speaker|громк|динамик/i.test(device.label));
            if (!handset || !speaker || handset.deviceId === speaker.deviceId) return;
            let loud = false;
            const switcher = action('speaker', async () => {
              const next = !loud;
              try {
                await remote.setSinkId(next ? speaker.deviceId : handset.deviceId);
                loud = next;
                switcher.title = t(loud ? 'earpiece' : 'speaker');
                switcher.setAttribute('aria-label', t(loud ? 'earpiece' : 'speaker'));
                switcher.setAttribute('aria-pressed', String(loud));
                switcher.querySelector('span')?.replaceChildren(document.createTextNode(t(loud ? 'earpiece' : 'speaker')));
              } catch (error) {
                console.warn('Audio output switching is unavailable', error?.name);
              }
            });
            switcher.setAttribute('aria-pressed', 'false');
            call.controls.prepend(switcher);
          }).catch(() => {});
        }
        const remoteStream = new MediaStream();
        remote.srcObject = remoteStream;
        peer.ontrack = ({track}) => {
          if (current !== call) return;
          remoteStream.addTrack(track);
          if (track.kind === 'video') {
            const updateVideo = () => {
              if (current !== call) return;
              const visible = !track.muted && track.readyState === 'live';
              remote.hidden = !visible;
              call.overlay.classList.toggle('umma-call-has-video', visible);
            };
            for (const event of ['unmute', 'mute', 'ended']) track.addEventListener(event, updateVideo);
            updateVideo();
          }
          void remote.play().catch(() => {
            if (current === call) playback.hidden = false;
          });
        };
        peer.onconnectionstatechange = () => {
          if (current !== call) return;
          if (peer.connectionState === 'connected') {
            clearTimeout(call.deadline);
            stopRinger(call);
            call.connected = true;
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
          } else if (peer.connectionState === 'disconnected' && call.connected) {
            call.status.textContent = t('reconnecting');
            armTimeout(call, 'unavailable', 15000);
          } else if (peer.connectionState === 'failed') {
            finish(call, 'unavailable');
          }
        };
        stream.getTracks().forEach(track => peer.addTrack(track, stream));
        if (call.incoming) await peer.setRemoteDescription({type: 'offer', sdp: call.offer});
        await peer.setLocalDescription(call.incoming ? await peer.createAnswer() : await peer.createOffer());
        await listenForIce(peer);
        if (current !== call) return;
        call.sent = true;
        const result = await request(call.incoming ? 'answer' : 'start', {
          id: call.id, clientId: call.clientId, mode: call.mode, sdp: peer.localDescription.sdp
        }, call.credentials);
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
          armTimeout(call, 'unanswered', 44000);
        } else if (!call.connected) {
          armTimeout(call, 'unavailable', 22000);
        }
        schedule(0);
      } catch (error) {
        finish(call, error.message === 'busy' ? 'busy' : 'unavailable');
      }
    }

    function start(mode, target) {
      if (current) return;
      void enableRinger();
      pollFailures = 0;
      current = {id: crypto.randomUUID(), mode, ...target, credentials: identity()};
      show(current);
      void establish(current);
    }

    function schedule(delay) {
      clearTimeout(pollTimer);
      pollTimer = setTimeout(poll, delay);
    }

    async function poll() {
      if (polling) return;
      polling = true;
      const call = current;
      // An outgoing request is not visible until the offer has been posted.
      const credentials = call ? call.credentials : identity();
      try {
        if ((!call && document.hidden) || !credentials || (call && !call.ready && !call.incoming)) return;
        const linked = !call ? requestedCall : null;
        const {call: state} = await request('poll', {id: call?.id || linked}, credentials);
        pollFailures = 0;
        if (current !== call) return;
        if (linked && requestedCall !== linked) return;
        if (linked) consumeLink();
        if (!call && state?.incoming && state.offer) {
          pollFailures = 0;
          current = {...state, credentials};
          show(current);
        } else if (linked && !call) {
          current = {id: linked, mode: 'audio', credentials};
          show(current);
          finish(current, 'expired', false);
        } else if (call && !state) {
          finish(call, call.ready && !call.incoming && !call.peer?.remoteDescription ? 'unanswered' : 'ended', false);
        } else if (call?.ready && !call.incoming && state?.answer && !call.peer.remoteDescription) {
          stopRinger(call);
          call.status.textContent = t('connecting');
          armTimeout(call, 'unavailable', 22000);
          await call.peer.setRemoteDescription({type: 'answer', sdp: state.answer});
        }
      } catch {
        if (call && ++pollFailures >= 3 && current === call) finish(call, 'unavailable');
      } finally {
        polling = false;
        schedule(current?.connected ? 3500 : current ? 1100 : 3000);
      }
    }

    navigator.serviceWorker?.addEventListener('message', event => {
      const data = event.data;
      if (data?.type === 'UMMA_OPEN_CALL' && validId(data.callId) && current?.id !== data.callId) {
        requestedCall = data.callId;
      }
      if (data?.type === 'UMMA_OPEN_CALL' || data?.type === 'UMMA_CALL_PUSH') schedule(0);
    });
    document.addEventListener('umma:staff-ready', () => schedule(0));
    document.addEventListener('click', enableRinger, {once: true, capture: true});
    document.addEventListener('visibilitychange', () => { if (!document.hidden) schedule(0); });
    window.addEventListener('pagehide', () => { if (current) finish(current, null, true, true); });
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
