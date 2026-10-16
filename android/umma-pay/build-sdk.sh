#!/usr/bin/env bash
set -euo pipefail
# Use a protected, persistent release keystore outside this repository.
: "${ANDROID_SDK_ROOT:?Set ANDROID_SDK_ROOT}"
: "${UMMA_KEYSTORE:?Set UMMA_KEYSTORE}"
: "${UMMA_KEYSTORE_PASSWORD:?Set UMMA_KEYSTORE_PASSWORD}"
repo_root="$(cd "$(dirname "$0")/../.." && pwd)"
build_dir="${UMMA_BUILD_DIR:-/tmp/umma-pay-build}"
mkdir -p "$build_dir/classes" "$build_dir/dex"
build_tools="$ANDROID_SDK_ROOT/build-tools/35.0.0"
android_jar="$ANDROID_SDK_ROOT/platforms/android-35/android.jar"
python3 - "$repo_root" "$build_dir" <<'PY'
import pathlib,sys
root,out=map(pathlib.Path,sys.argv[1:]);s=(root/'android/umma-pay/app/src/main/AndroidManifest.xml').read_text();(out/'AndroidManifest.xml').write_text(s.replace('<manifest ','<manifest package="global.umma.pay" ',1))
PY
"$build_tools/aapt2" compile --dir "$repo_root/android/umma-pay/app/src/main/res" -o "$build_dir/resources.zip"
"$build_tools/aapt2" link -o "$build_dir/base.apk" -I "$android_jar" --manifest "$build_dir/AndroidManifest.xml" --min-sdk-version 26 --target-sdk-version 35 --version-code 2 --version-name 1.1.0 "$build_dir/resources.zip"
if command -v javac >/dev/null; then
 javac -source 8 -target 8 -classpath "$android_jar" -d "$build_dir/classes" "$repo_root"/android/umma-pay/app/src/main/java/global/umma/pay/*.java
else
 : "${UMMA_ECJ_JAR:?Set UMMA_ECJ_JAR for Eclipse compiler 3.38.0}"
 java -jar "$UMMA_ECJ_JAR" -1.8 -classpath "$android_jar" -d "$build_dir/classes" "$repo_root"/android/umma-pay/app/src/main/java/global/umma/pay/*.java
fi
find "$build_dir/classes" -name '*.class' > "$build_dir/classes.list"
"$build_tools/d8" --lib "$android_jar" --min-api 26 --output "$build_dir/dex" @"$build_dir/classes.list"
(cd "$build_dir/dex" && zip -q -j "$build_dir/base.apk" classes.dex)
"$build_tools/zipalign" -f -p 4 "$build_dir/base.apk" "$build_dir/aligned.apk"
"$build_tools/apksigner" sign --ks "$UMMA_KEYSTORE" --ks-key-alias umma-pay --ks-pass env:UMMA_KEYSTORE_PASSWORD --out "$build_dir/UMMA-Pay.apk" "$build_dir/aligned.apk"
"$build_tools/apksigner" verify --verbose "$build_dir/UMMA-Pay.apk"
