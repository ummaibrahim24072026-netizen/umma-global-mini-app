"""Run the real Android listener against small JVM platform doubles (no emulator/network)."""
import os,pathlib,tempfile,subprocess,shutil
root=pathlib.Path(__file__).resolve().parents[1]
stubs={
'android/content/SharedPreferences.java':'''package android.content; import java.util.*; public class SharedPreferences {private final Map<String,Object> values=new HashMap<>();public boolean getBoolean(String k,boolean d){return values.containsKey(k)?(Boolean)values.get(k):d;}public long getLong(String k,long d){return values.containsKey(k)?(Long)values.get(k):d;}public String getString(String k,String d){return values.containsKey(k)?(String)values.get(k):d;}public Editor edit(){return new Editor();}public class Editor{public Editor putBoolean(String k,boolean v){values.put(k,v);return this;}public Editor putLong(String k,long v){values.put(k,v);return this;}public Editor putInt(String k,int v){values.put(k,v);return this;}public Editor putString(String k,String v){values.put(k,v);return this;}public void apply(){}}}''',
'android/content/Context.java':'''package android.content; public class Context {static final SharedPreferences prefs=new SharedPreferences();public SharedPreferences getSharedPreferences(String name,int mode){return prefs;}}''',
'android/content/ComponentName.java':'''package android.content; public class ComponentName {public ComponentName(Context c,Class<?> type){}}''',
'android/os/Bundle.java':'''package android.os; import java.util.*; public class Bundle extends HashMap<String,Object>{public CharSequence getCharSequence(String key){return (CharSequence)get(key);}public CharSequence[] getCharSequenceArray(String key){return (CharSequence[])get(key);}}''',
'android/os/Looper.java':'''package android.os; public class Looper {public static Looper getMainLooper(){return new Looper();}}''',
'android/os/Handler.java':'''package android.os; public class Handler {public Handler(Looper l){} public boolean post(Runnable r){r.run();return true;}}''',
'android/app/Notification.java':'''package android.app; import android.os.Bundle; public class Notification {public static final int FLAG_GROUP_SUMMARY=512;public static final String EXTRA_TITLE="title",EXTRA_BIG_TEXT="big",EXTRA_TEXT="text",EXTRA_TEXT_LINES="lines";public int flags;public Bundle extras=new Bundle();}''',
'android/service/notification/StatusBarNotification.java':'''package android.service.notification; import android.app.Notification; public class StatusBarNotification {private final String pkg,key;private final long time;private final Notification n;public StatusBarNotification(String p,String k,long t,Notification value){pkg=p;key=k;time=t;n=value;}public String getPackageName(){return pkg;}public String getKey(){return key;}public long getPostTime(){return time;}public Notification getNotification(){return n;}}''',
'android/service/notification/NotificationListenerService.java':'''package android.service.notification; import android.content.*;public class NotificationListenerService extends Context {public static int rebinds;public boolean readable;public StatusBarNotification[] visible;public StatusBarNotification[] getActiveNotifications(){if(!readable)throw new IllegalStateException("not connected");return visible;}public static void requestRebind(ComponentName c){rebinds++;}public void onDestroy(){}}''',
'org/json/JSONObject.java':'''package org.json; import java.util.*; public class JSONObject extends HashMap<String,Object>{public JSONObject put(String k,Object value){super.put(k,value);return this;}}''',
'global/umma/pay/Queue.java':'''package global.umma.pay;import java.util.*;import org.json.*;import android.content.*;final class Queue implements AutoCloseable {static final Map<String,JSONObject> items=new HashMap<>();Queue(Context c){}void put(String k,JSONObject v){items.putIfAbsent(k,v);}public void close(){}}''',
'global/umma/pay/UploadJob.java':'''package global.umma.pay;import android.content.*;final class UploadJob {static int sends;static void status(Context c,String s){}static void schedule(Context c){}static void sendNow(Context c){sends++;}}''',
'global/umma/pay/RecoveryTest.java':'''package global.umma.pay;
import android.app.*;import android.content.*;import android.service.notification.*;import org.json.*;
public class RecoveryTest {
 static void check(boolean value,String why){if(!value)throw new AssertionError(why);}
 static StatusBarNotification n(String pkg,String key,long stamp,String text,int flags){Notification value=new Notification();value.flags=flags;value.extras.put(Notification.EXTRA_TITLE,"Thong bao VCB");value.extras.put(Notification.EXTRA_TEXT,text);value.extras.put(Notification.EXTRA_BIG_TEXT,"");return new StatusBarNotification(pkg,key,stamp,value);}
 public static void main(String[] args){
  long now=System.currentTimeMillis(),posted=now-600000;
  String good="TK VCB 1212121212 +10,000 VND. Ref UMMA 86#SP#synthetic";
  check(NotificationText.choose("",good,null).equals(good),"empty bigText fallback");
  check(NotificationText.choose("short bank summary",good,null).equals(good),"choose complete reference instead of summary");
  check(NotificationText.choose(null,null,new CharSequence[]{good}).equals(good),"textLines fallback");
  check(!NotificationText.allowed(good+" OTP 123456"),"OTP excluded");
  BankListener service=new BankListener();service.getSharedPreferences("state",0).edit().putBoolean("paired",true).apply();
  StatusBarNotification payment=n("com.VCB","payment",posted,good,0);
  service.visible=new StatusBarNotification[]{payment,n("camera.app","other",now,good,0),n("com.VCB","summary",now,good,512),n("com.VCB","old",now-86400001L,good,0),n("com.VCB","otp",now,good+" OTP",0),n("com.VCB","unrelated",now,"Balance updated",0)};
  BankListener.recover(service);check(NotificationListenerService.rebinds==1,"rebind requested while disconnected");check(Queue.items.size()==0,"no reads before connected");
  service.readable=true;service.onListenerConnected();check(BankListener.connected(),"actual connection exposed");check(Queue.items.size()==1,"missed visible payment recovered, other source/old/summary/OTP excluded");
  JSONObject body=Queue.items.values().iterator().next();check(body.get("postedAt").equals(posted),"original bank notification time retained");check(body.get("text").toString().endsWith(good),"full text retained");
  BankListener.recover(service);check(Queue.items.size()==1,"manual rescan deduplicates");
  service.readable=false;service.onListenerDisconnected();check(!BankListener.connected(),"permission and connection are distinct");check(NotificationListenerService.rebinds==2,"disconnect requests automatic rebind");
  service.readable=true;service.visible=new StatusBarNotification[]{payment,n("com.VCB","next",now,good.replace("86","87"),0)};service.onListenerConnected();check(Queue.items.size()==2,"reconnect captures next payment without duplicate");
  service.onDestroy();check(!BankListener.connected(),"destroy clears stale instance");
  System.out.println("PASS Android relay: visible payment recovery, original timestamp, reconnect/manual scan, actual service state, source/age/OTP/group filtering, text variants and deduplication (JVM doubles; not a Samsung device test)");
 }
}'''
}
with tempfile.TemporaryDirectory(prefix='umma-relay-qa-') as tmp:
 out=pathlib.Path(tmp);sources=[]
 for name,content in stubs.items():
  p=out/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(content);sources.append(str(p))
 for name in ['BankListener.java','NotificationText.java']:
  sources.append(str(root/'android/umma-pay/app/src/main/java/global/umma/pay'/name))
 compiler=['javac','-source','8','-target','8'] if shutil.which('javac') else ['java','-jar',os.environ['UMMA_ECJ_JAR'],'-1.8']
 subprocess.run(compiler+['-d',str(out)]+sources,check=True)
 subprocess.run(['java','-cp',str(out),'global.umma.pay.RecoveryTest'],check=True)
