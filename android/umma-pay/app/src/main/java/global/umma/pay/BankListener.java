package global.umma.pay;
import android.app.Notification;
import android.os.Bundle;
import android.service.notification.*;
import org.json.JSONObject;
import java.security.MessageDigest;
public class BankListener extends NotificationListenerService {
 public void onListenerConnected(){UploadJob.status(this,"Доступ к уведомлениям включён");UploadJob.schedule(this);UploadJob.sendNow(this);}
 public void onNotificationPosted(StatusBarNotification s){
  if(!"com.VCB".equals(s.getPackageName())||(s.getNotification().flags&Notification.FLAG_GROUP_SUMMARY)!=0)return;
  try{if(!getSharedPreferences("state",0).getBoolean("paired",false))return;
   Bundle b=s.getNotification().extras;String title=String.valueOf(b.getCharSequence(Notification.EXTRA_TITLE,""));CharSequence big=b.getCharSequence(Notification.EXTRA_BIG_TEXT);String text=big!=null?big.toString():String.valueOf(b.getCharSequence(Notification.EXTRA_TEXT,""));String full=title+"\n"+text;
   // Never upload OTPs or unrelated bank messages.
   String lower=full.toLowerCase(java.util.Locale.ROOT);if(!lower.contains("umma")||lower.contains("otp"))return;
   byte[] digest=MessageDigest.getInstance("SHA-256").digest((s.getKey()+"|"+s.getPostTime()+"|"+full).getBytes("UTF-8"));StringBuilder id=new StringBuilder();for(byte x:digest)id.append(String.format("%02x",x&255));
   JSONObject body=new JSONObject().put("packageName","com.VCB").put("text",full).put("postedAt",s.getPostTime()).put("eventKey",id.toString());
   try(Queue q=new Queue(this)){q.put(id.toString(),body);}UploadJob.status(this,"Получено уведомление VCB, отправляем…");UploadJob.schedule(this);UploadJob.sendNow(this);
  }catch(Exception e){UploadJob.status(this,"Ошибка обработки уведомления: "+e.getMessage());}
 }
}
