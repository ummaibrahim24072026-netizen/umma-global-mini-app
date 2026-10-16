package global.umma.pay;
import org.json.JSONObject;
import java.net.*;
import java.io.*;
final class Api {
 static JSONObject post(JSONObject body,String token) throws Exception {
  HttpURLConnection c=(HttpURLConnection)new URL("https://zwzojugspldexyyljwpr.supabase.co/functions/v1/umma-pay").openConnection();
  c.setRequestMethod("POST");c.setConnectTimeout(15000);c.setReadTimeout(20000);c.setDoOutput(true);c.setRequestProperty("Content-Type","application/json");if(token!=null)c.setRequestProperty("Authorization","Bearer "+token);
  try{try(OutputStream out=c.getOutputStream()){out.write(body.toString().getBytes("UTF-8"));}
   int status=c.getResponseCode();InputStream in=status<400?c.getInputStream():c.getErrorStream();ByteArrayOutputStream bytes=new ByteArrayOutputStream();if(in!=null)try(InputStream stream=in){byte[] b=new byte[4096];int n;while((n=stream.read(b))!=-1){bytes.write(b,0,n);if(bytes.size()>32000)throw new IOException("Response too large");}}
   JSONObject result=new JSONObject(bytes.toString("UTF-8"));if(status>=400||!result.optBoolean("ok"))throw new IOException(result.optString("error","Нет связи: "+status));return result;
  }finally{c.disconnect();}
 }
}
