package global.umma.pay;
import android.content.Context;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import java.security.KeyStore;
import javax.crypto.*;
import javax.crypto.spec.GCMParameterSpec;
final class Vault {
 static javax.crypto.SecretKey key() throws Exception {
  KeyStore ks=KeyStore.getInstance("AndroidKeyStore");ks.load(null);
  if(!ks.containsAlias("umma-pay")){KeyGenerator kg=KeyGenerator.getInstance("AES","AndroidKeyStore");kg.init(new KeyGenParameterSpec.Builder("umma-pay",KeyProperties.PURPOSE_ENCRYPT|KeyProperties.PURPOSE_DECRYPT).setBlockModes("GCM").setEncryptionPaddings("NoPadding").build());kg.generateKey();}
  return (javax.crypto.SecretKey)ks.getKey("umma-pay",null);
 }
 static void save(Context c,String token) throws Exception {Cipher x=Cipher.getInstance("AES/GCM/NoPadding");x.init(Cipher.ENCRYPT_MODE,key());c.getSharedPreferences("vault",0).edit().putString("iv",Base64.encodeToString(x.getIV(),2)).putString("token",Base64.encodeToString(x.doFinal(token.getBytes("UTF-8")),2)).commit();}
 static String get(Context c) throws Exception {android.content.SharedPreferences p=c.getSharedPreferences("vault",0);String t=p.getString("token",null);if(t==null)return null;Cipher x=Cipher.getInstance("AES/GCM/NoPadding");x.init(Cipher.DECRYPT_MODE,key(),new GCMParameterSpec(128,Base64.decode(p.getString("iv",""),2)));return new String(x.doFinal(Base64.decode(t,2)),"UTF-8");}
}
