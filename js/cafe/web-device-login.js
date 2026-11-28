(() => {
  'use strict';

  const get = id => document.getElementById(id);
  const auth = window.ummaStaffAuth;
  const page = new URL('staff.html', location.href);
  const decoderUrl = new URL('../vendor/jsqr-1.4.0.js', document.currentScript.src);
  const endpoint = 'https://zwzojugspldexyyljwpr.supabase.co/functions/v1/cafe-device-login';
  const add = get('webAddDevice');
  const scan = get('webScanDevice');
  const codeDialog = get('webDeviceCodeDialog');
  const scanDialog = get('webDeviceScanDialog');
  const qrRoot = get('webDeviceQr');
  const codeStatus = get('webDeviceCodeStatus');
  const remainingTime = get('webDeviceCountdown');
  const scanStatus = get('webDeviceScanStatus');
  const loginStatus = get('webDeviceLoginStatus');
  const refresh = get('webDeviceRefresh');
  const video = get('webDeviceCamera');
  const qrPattern = /^[a-f0-9]{64}$/;
  let issuedCode = '';
  let issuedWith = '';
  let issueVersion = 0;
  let countdown;
  let cameraVersion = 0;
  let stream;
  let frame;
  let decoder;
  let redeeming = false;

  window.ummaStaffDeviceLogin = {enable() { add.hidden = false; }};
  if (get('webLogin').hidden) window.ummaStaffDeviceLogin.enable();
  scan.hidden = new URLSearchParams(location.hash.slice(1)).has('invite');

  async function request(body) {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(body),
      cache: 'no-store',
      signal: AbortSignal.timeout(12000),
    });
    const result = await response.json();
    if (!response.ok || !result.ok) throw new Error(result.error || 'Не удалось подключить устройство.');
    return result;
  }

  function cancelCode(code, credential) {
    if (code) void request({action: 'cancel', code, credential}).catch(() => {});
  }

  function clearCode() {
    issueVersion++;
    clearInterval(countdown);
    qrRoot.replaceChildren();
    remainingTime.hidden = true;
    cancelCode(issuedCode, issuedWith);
    issuedCode = '';
    issuedWith = '';
  }

  async function issue() {
    clearCode();
    const version = issueVersion;
    const credential = auth.credential();
    const started = Date.now();
    refresh.hidden = true;
    codeStatus.textContent = 'Создаём QR-код…';
    try {
      const {code, validForSeconds} = await request({action: 'issue', credential});
      if (!codeDialog.open || version !== issueVersion) {
        cancelCode(code, credential);
        return;
      }
      issuedCode = code;
      issuedWith = credential;
      const link = new URL(page);
      link.hash = new URLSearchParams({device: code});
      const qr = qrcode(0, 'M');
      qr.addData(link.href);
      qr.make();
      qrRoot.innerHTML = qr.createSvgTag({cellSize: 5, margin: 20, scalable: true});
      codeStatus.textContent = 'QR-код для одного входа. Не пересылайте его другим.';
      remainingTime.hidden = false;
      const expires = started + validForSeconds * 1000;
      const update = () => {
        const remaining = Math.max(0, Math.ceil((expires - Date.now()) / 1000));
        if (remaining) {
          remainingTime.textContent = 'Осталось ' + remaining + ' сек.';
          return;
        }
        clearCode();
        codeStatus.textContent = 'Срок действия QR-кода истёк.';
        refresh.hidden = false;
      };
      countdown = setInterval(update, 1000);
      update();
    } catch (error) {
      if (version !== issueVersion || !codeDialog.open) return;
      clearCode();
      codeStatus.textContent = error.message;
      refresh.hidden = false;
    }
  }

  function parseCode(value) {
    try {
      const url = new URL(value);
      if (url.origin !== page.origin || url.pathname !== page.pathname || url.search) return null;
      const code = new URLSearchParams(url.hash.slice(1)).get('device');
      return qrPattern.test(code) ? code : null;
    } catch {
      return null;
    }
  }

  async function redeem(code, status) {
    if (redeeming) return;
    if (auth.credential()) {
      status.textContent = 'Выйдите из текущего аккаунта на этом устройстве и отсканируйте код ещё раз.';
      return;
    }
    redeeming = true;
    scan.disabled = true;
    get('webLoginSubmit').disabled = true;
    status.textContent = 'Открываем рабочее место…';
    try {
      const {token} = await request({action: 'redeem', code});
      if (auth.credential()) throw new Error('На устройстве уже открыт аккаунт. Выйдите из него и повторите вход.');
      auth.save(token);
      if (scanDialog.open) scanDialog.close();
      document.dispatchEvent(new Event('umma:staff-device-login'));
    } catch (error) {
      status.textContent = error.message;
      loginStatus.textContent = error.message;
    } finally {
      redeeming = false;
      scan.disabled = false;
      get('webLoginSubmit').disabled = false;
    }
  }

  function loadDecoder() {
    if (!decoder) {
      decoder = new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = decoderUrl.href;
        script.onload = () => window.jsQR ? resolve(window.jsQR) : reject(new Error('Сканер недоступен'));
        script.onerror = () => {
          script.remove();
          reject(new Error('Сканер недоступен'));
        };
        document.head.append(script);
      }).catch(error => {
        decoder = null;
        throw error;
      });
    }
    return decoder;
  }

  function stopCamera() {
    cameraVersion++;
    clearTimeout(frame);
    stream?.getTracks().forEach(track => track.stop());
    stream = null;
    video.srcObject = null;
    video.hidden = true;
  }

  async function startCamera() {
    const version = ++cameraVersion;
    scanStatus.textContent = 'Разрешите доступ к камере планшета.';
    try {
      const decode = await loadDecoder();
      if (version !== cameraVersion || !scanDialog.open) return;
      const camera = await navigator.mediaDevices.getUserMedia({audio: false, video: {facingMode: {ideal: 'environment'}}});
      if (version !== cameraVersion || !scanDialog.open) {
        camera.getTracks().forEach(track => track.stop());
        return;
      }
      stream = camera;
      video.srcObject = stream;
      video.hidden = false;
      await video.play();
      if (version !== cameraVersion || !scanDialog.open) return;
      scanStatus.textContent = '';
      const canvas = document.createElement('canvas');
      const context = canvas.getContext('2d', {willReadFrequently: true});
      const readFrame = () => {
        if (version !== cameraVersion || !scanDialog.open) return;
        if (video.readyState >= 2 && video.videoWidth && video.videoHeight) {
          const scale = Math.min(1, 960 / Math.max(video.videoWidth, video.videoHeight));
          const width = Math.max(1, Math.round(video.videoWidth * scale));
          const height = Math.max(1, Math.round(video.videoHeight * scale));
          if (canvas.width !== width) canvas.width = width;
          if (canvas.height !== height) canvas.height = height;
          context.drawImage(video, 0, 0, width, height);
          const image = context.getImageData(0, 0, width, height);
          const found = decode(image.data, width, height, {inversionAttempts: 'dontInvert'});
          if (found) {
            const code = parseCode(found.data);
            if (code) {
              stopCamera();
              void redeem(code, scanStatus);
              return;
            }
            scanStatus.textContent = 'Покажите QR-код из раздела «Добавить устройство» UMMA.';
          }
        }
        frame = setTimeout(readFrame, 180);
      };
      readFrame();
    } catch {
      if (version !== cameraVersion || !scanDialog.open) return;
      stopCamera();
      scanStatus.textContent = 'Камера недоступна. Разрешите доступ или отсканируйте QR штатной камерой планшета.';
    }
  }

  add.onclick = () => {
    add.closest('details').open = false;
    codeDialog.showModal();
    void issue();
  };
  refresh.onclick = issue;
  codeDialog.addEventListener('close', clearCode);
  scan.onclick = async () => {
    loginStatus.textContent = '';
    scan.disabled = true;
    await window.ummaCounterFullscreen?.enter();
    scan.disabled = false;
    scanDialog.showModal();
    void startCamera();
  };
  scanDialog.addEventListener('close', () => {
    stopCamera();
    if (!auth.credential()) window.ummaCounterFullscreen?.leave();
  });
  window.addEventListener('pagehide', () => {
    stopCamera();
    clearCode();
  });

  if (new URLSearchParams(location.hash.slice(1)).has('device')) {
    const code = parseCode(location.href);
    history.replaceState(null, '', location.pathname + location.search);
    scan.hidden = false;
    if (auth.credential()) {
      scanDialog.showModal();
      scanStatus.textContent = 'Выйдите из текущего аккаунта на этом устройстве и отсканируйте код ещё раз.';
    } else if (code) {
      void redeem(code, loginStatus);
    } else {
      loginStatus.textContent = 'Некорректный QR-код. Создайте новый на телефоне.';
    }
  }
})();
