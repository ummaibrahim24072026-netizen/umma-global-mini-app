package global.umma.pay;
import android.app.*;
import android.os.Bundle;
import android.content.*;
import android.provider.Settings;
import android.widget.*;
import org.json.JSONObject;
import java.security.SecureRandom;
public class MainActivity extends Activity {
 TextView status;EditText code;Button pair;
 final android.os.Handler ui=new android.os.Handler(android.os.Looper.getMainLooper());
 final Runnable repaint=new Runnable(){public void run(){if(status!=null)refresh();ui.postDelayed(this,1000);}};
 boolean paired(){return getSharedPreferences("state",0).getBoolean("paired",false);}
 boolean accessGranted(){String listeners=Settings.Secure.getString(getContentResolver(),"enabled_notification_listeners");return listeners!=null&&listeners.contains(getPackageName()+"/");}
 void recover(){if(paired()&&accessGranted())BankListener.recover(this);UploadJob.sendNow(this);UploadJob.schedule(this);}
 String time(long value){return value==0?"ещё нет":new java.text.SimpleDateFormat("dd.MM HH:mm:ss",java.util.Locale.ROOT).format(new java.util.Date(value));}
 public void onCreate(Bundle b){super.onCreate(b);LinearLayout root=new LinearLayout(this);root.setOrientation(1);root.setPadding(32,64,32,32);root.setBackgroundColor(0xfff5f6ef);ScrollView scroll=new ScrollView(this);scroll.addView(root);setContentView(scroll);
  TextView title=new TextView(this);title.setText("UMMA Pay 1.1");title.setTextSize(30);title.setTextColor(0xff09594b);root.addView(title);
  TextView help=new TextView(this);help.setText("Подтверждение оплат UMMA по уведомлениям Vietcombank. Передаются только уведомления VCB с назначением UMMA. Банковский пароль и OTP не нужны.\n\n1. Введите код подключения.\n2. Разрешите доступ к уведомлениям для UMMA Pay.\n3. Samsung → Батарея → Без ограничений. Добавьте UMMA Pay в приложения, которые не переходят в спящий режим.\n\nТелефон должен получать push VCB и иметь интернет.");root.addView(help);
  code=new EditText(this);code.setHint("Код подключения");code.setSingleLine();root.addView(code);
  pair=new Button(this);pair.setText("Подключить телефон");root.addView(pair);pair.setOnClickListener(v->pair());
  Button access=new Button(this);access.setText("Разрешить уведомления");root.addView(access);access.setOnClickListener(v->startActivity(new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)));
  Button check=new Button(this);check.setText("Восстановить уведомления / проверить связь");root.addView(check);check.setOnClickListener(v->{recover();new Thread(()->{try{String t=Vault.get(this);if(t==null)throw new Exception("Сначала подключите телефон");JSONObject r=Api.post(new JSONObject().put("action","health"),t);getSharedPreferences("state",0).edit().putString("health","Сервер доступен. Счёт ••••"+r.optString("account").replaceAll(".*(.{4})$","$1")).putLong("health_at",System.currentTimeMillis()).apply();}catch(Exception e){getSharedPreferences("state",0).edit().putString("health","Проверка связи: "+e.getMessage()).apply();}runOnUiThread(this::refresh);}).start();});
  Button battery=new Button(this);battery.setText("Настройки работы в фоне");root.addView(battery);battery.setOnClickListener(v->{try{startActivity(new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS));}catch(Exception e){startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,android.net.Uri.parse("package:"+getPackageName())));}});
  status=new TextView(this);status.setPadding(0,32,0,0);root.addView(status);refresh();
 }
 void pair(){String activation=code.getText().toString().replaceAll("[\\s-]","").toUpperCase(java.util.Locale.ROOT);if(!activation.matches("[A-F0-9]{32}")){status.setText("Вставьте полный код подключения");return;}pair.setEnabled(false);
  new Thread(()->{try{String token=Vault.get(this);if(token==null){byte[] bytes=new byte[32];new SecureRandom().nextBytes(bytes);StringBuilder s=new StringBuilder();for(byte x:bytes)s.append(String.format("%02x",x&255));token=s.toString();Vault.save(this,token);}Api.post(new JSONObject().put("action","pair").put("code",activation).put("token",token),null);getSharedPreferences("state",0).edit().putBoolean("paired",true).commit();UploadJob.status(this,"Телефон подключён. Разрешите доступ к уведомлениям.");}catch(Exception e){UploadJob.status(this,e.getMessage());}runOnUiThread(()->{pair.setEnabled(true);refresh();});}).start();
 }
 void refresh(){android.content.SharedPreferences state=getSharedPreferences("state",0);try(Queue q=new Queue(this)){
  status.setText((paired()?"Телефон подключён":"Телефон ещё не подключён")+"\nДоступ к уведомлениям: "+(accessGranted()?"включён":"выключен")+"\nСлужба чтения: "+(BankListener.connected()?"работает":"не подключена — нажмите восстановление")+"\nВ очереди: "+q.count()+"\nПоследнее перечитывание: "+time(state.getLong("last_scan_at",0))+"\nВидимых VCB: "+state.getInt("visible_vcb",0)+", с UMMA за сутки: "+state.getInt("matching_vcb",0)+"\nПоследнее UMMA: "+time(state.getLong("last_capture_at",0))+"\n"+state.getString("capture","")+"\nПоследняя отправка: "+state.getString("last","")+"\n"+state.getString("health","")+"\nПроверка связи: "+time(state.getLong("health_at",0)));
 }}
 protected void onResume(){super.onResume();if(status!=null){recover();ui.removeCallbacks(repaint);ui.post(repaint);}}
 protected void onPause(){ui.removeCallbacks(repaint);super.onPause();}
}
