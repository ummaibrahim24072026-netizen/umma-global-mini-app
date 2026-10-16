package global.umma.pay;
import android.app.job.*;
import android.content.*;
import org.json.JSONObject;
public class UploadJob extends JobService {
 volatile boolean stopped;
 static void schedule(Context c){JobScheduler s=(JobScheduler)c.getSystemService(JOB_SCHEDULER_SERVICE);if(s.getPendingJob(13)==null)s.schedule(new JobInfo.Builder(13,new ComponentName(c,UploadJob.class)).setRequiredNetworkType(JobInfo.NETWORK_TYPE_ANY).setBackoffCriteria(30000,JobInfo.BACKOFF_POLICY_EXPONENTIAL).build());}
 static final java.util.concurrent.atomic.AtomicBoolean sending=new java.util.concurrent.atomic.AtomicBoolean(false);
 static void sendNow(Context context){final Context c=context.getApplicationContext();if(!sending.compareAndSet(false,true))return;new Thread(()->{try(Queue q=new Queue(c)){String t=Vault.get(c);if(t==null)return;String[] row;int n=0;while(n++<50&&(row=q.next())!=null){JSONObject result=Api.post(new JSONObject(row[1]),t);q.remove(row[0]);status(c,result.optString("state").equals("confirmed")?"Оплачено: заказ №"+result.optString("orderNumber"):"Уведомление принято, статус: "+result.optString("state"));}}catch(Exception e){status(c,"Ожидаем связь, повторим отправку");}finally{sending.set(false);schedule(c);}},"umma-instant-upload").start();}
 static void status(Context c,String value){c.getSharedPreferences("state",0).edit().putString("last",value).apply();}
 public boolean onStartJob(JobParameters p){stopped=false;new Thread(()->{boolean retry=false;try(Queue q=new Queue(this)){String token=Vault.get(this);if(token==null)return;String[] row;int sent=0;while(!stopped&&sent++<50&&(row=q.next())!=null){JSONObject result=Api.post(new JSONObject(row[1]),token);q.remove(row[0]);status(this,result.optString("state").equals("confirmed")?"Оплачено: заказ №"+result.optString("orderNumber"):"Нужна проверка: "+result.optString("reason","повтор уведомления"));}retry=q.count()>0;}catch(Exception e){status(this,"Повторяем отправку: "+e.getMessage());retry=true;}finally{if(!stopped)jobFinished(p,retry);}},"umma-upload").start();return true;}
 public boolean onStopJob(JobParameters p){stopped=true;return true;}
}
