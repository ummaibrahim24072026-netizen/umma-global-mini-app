package global.umma.pay;
import android.app.Notification;
import android.content.*;
import android.os.*;
import android.service.notification.*;
import org.json.JSONObject;
import java.security.MessageDigest;
public class BankListener extends NotificationListenerService {
 private static volatile BankListener active;
 static boolean connected(){return active!=null;}
 static void recover(Context context){
  final BankListener listener=active;
  if(listener!=null)new Handler(Looper.getMainLooper()).post(()->{if(active==listener)listener.scanVisible();});
  else try{requestRebind(new ComponentName(context,BankListener.class));}catch(Exception e){UploadJob.status(context,"Переподключите доступ к уведомлениям в настройках UMMA Pay");}
 }
 public void onListenerConnected(){
  active=this;getSharedPreferences("state",0).edit().putLong("listener_connected_at",System.currentTimeMillis()).apply();
  scanVisible();UploadJob.schedule(this);UploadJob.sendNow(this);
 }
 public void onListenerDisconnected(){if(active==this)active=null;UploadJob.status(this,"Служба отключена Android, запрашиваем восстановление");recover(this);}
 public void onDestroy(){if(active==this)active=null;super.onDestroy();}
 public void onNotificationPosted(StatusBarNotification notification){capture(notification);}
 private void scanVisible(){
  try{StatusBarNotification[] visible=getActiveNotifications();int seen=0,accepted=0;
   if(visible!=null)for(StatusBarNotification notification:visible){if("com.VCB".equals(notification.getPackageName()))seen++;if(capture(notification))accepted++;}
   getSharedPreferences("state",0).edit().putLong("last_scan_at",System.currentTimeMillis()).putInt("visible_vcb",seen).putInt("matching_vcb",accepted).apply();
  }catch(Exception e){UploadJob.status(this,"Не удалось перечитать уведомления. Выключите и включите доступ UMMA Pay.");}
 }
 private boolean capture(StatusBarNotification s){
  if(s==null||!"com.VCB".equals(s.getPackageName())||(s.getNotification().flags&Notification.FLAG_GROUP_SUMMARY)!=0)return false;
  try{
   android.content.SharedPreferences state=getSharedPreferences("state",0);
   state.edit().putLong("last_vcb_at",System.currentTimeMillis()).apply();
   if(!state.getBoolean("paired",false))return false;
   if(!NotificationText.recent(s.getPostTime(),System.currentTimeMillis()))return false;
   Bundle b=s.getNotification().extras;
   String full=NotificationText.clean(b.getCharSequence(Notification.EXTRA_TITLE))+"\n"+NotificationText.choose(b.getCharSequence(Notification.EXTRA_BIG_TEXT),b.getCharSequence(Notification.EXTRA_TEXT),b.getCharSequenceArray(Notification.EXTRA_TEXT_LINES));
   if(!NotificationText.allowed(full)){state.edit().putString("capture","Уведомление VCB пропущено: нет UMMA, есть OTP или слишком длинный текст").apply();return false;}
   byte[] digest=MessageDigest.getInstance("SHA-256").digest((s.getKey()+"|"+s.getPostTime()+"|"+full).getBytes("UTF-8"));StringBuilder id=new StringBuilder();for(byte x:digest)id.append(String.format("%02x",x&255));
   JSONObject body=new JSONObject().put("packageName","com.VCB").put("text",full).put("postedAt",s.getPostTime()).put("eventKey",id.toString());
   try(Queue q=new Queue(this)){q.put(id.toString(),body);}
   state.edit().putLong("last_capture_at",System.currentTimeMillis()).putString("capture","Уведомление UMMA найдено, поставлено в очередь").apply();
   UploadJob.schedule(this);UploadJob.sendNow(this);return true;
  }catch(Exception e){UploadJob.status(this,"Ошибка обработки уведомления: "+e.getMessage());return false;}
 }
}
