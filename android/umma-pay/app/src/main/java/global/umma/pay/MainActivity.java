package global.umma.pay;
import android.app.*;
import android.os.Bundle;
import android.content.*;
import android.provider.Settings;
import android.view.*;
import android.widget.*;
import org.json.JSONObject;
import java.security.SecureRandom;
public class MainActivity extends Activity {
 TextView status;EditText code;Button pair;
 public void onCreate(Bundle b){super.onCreate(b);LinearLayout root=new LinearLayout(this);root.setOrientation(1);root.setPadding(32,64,32,32);root.setBackgroundColor(0xfff5f6ef);ScrollView scroll=new ScrollView(this);scroll.addView(root);setContentView(scroll);
  TextView title=new TextView(this);title.setText("UMMA Pay");title.setTextSize(30);title.setTextColor(0xff09594b);root.addView(title);
  TextView help=new TextView(this);help.setText("Подтверждение оплат UMMA по уведомлениям Vietcombank. Передаются только уведомления VCB с назначением UMMA. Банковский пароль и OTP не нужны.\n\n1. Введите код подключения.\n2. Разрешите доступ к уведомлениям для UMMA Pay.\n3. Samsung → Батарея → Без ограничений. Добавьте UMMA Pay в приложения, которые не переходят в спящий режим.\n\nТелефон должен получать push VCB и иметь интернет.");root.addView(help);
  code=new EditText(this);code.setHint("Код подключения");code.setSingleLine();root.addView(code);
  pair=new Button(this);pair.setText("Подключить телефон");root.addView(pair);pair.setOnClickListener(v->pair());
  Button access=new Button(this);access.setText("Разрешить уведомления");root.addView(access);access.setOnClickListener(v->startActivity(new Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS)));
  Button check=new Button(this);check.setText("Проверить связь / повторить отправку");root.addView(check);check.setOnClickListener(v->{UploadJob.schedule(this);new Thread(()->{try{String t=Vault.get(this);if(t==null)throw new Exception("Сначала подключите телефон");JSONObject r=Api.post(new JSONObject().put("action","health"),t);UploadJob.status(this,"Сервер доступен. Счёт ••••"+r.optString("account").replaceAll(".*(.{4})$","$1"));}catch(Exception e){UploadJob.status(this,e.getMessage());}runOnUiThread(this::refresh);}).start();});
  status=new TextView(this);status.setPadding(0,32,0,0);root.addView(status);refresh();
 }
 void pair(){String activation=code.getText().toString().replaceAll("[\\s-]","").toUpperCase(java.util.Locale.ROOT);if(!activation.matches("[A-F0-9]{32}")){status.setText("Вставьте полный код подключения");return;}pair.setEnabled(false);
  new Thread(()->{try{String token=Vault.get(this);if(token==null){byte[] bytes=new byte[32];new SecureRandom().nextBytes(bytes);StringBuilder s=new StringBuilder();for(byte x:bytes)s.append(String.format("%02x",x&255));token=s.toString();Vault.save(this,token);}Api.post(new JSONObject().put("action","pair").put("code",activation).put("token",token),null);getSharedPreferences("state",0).edit().putBoolean("paired",true).commit();UploadJob.status(this,"Телефон подключён. Разрешите доступ к уведомлениям.");}catch(Exception e){UploadJob.status(this,e.getMessage());}runOnUiThread(()->{pair.setEnabled(true);refresh();});}).start();
 }
 void refresh(){String listeners=Settings.Secure.getString(getContentResolver(),"enabled_notification_listeners");boolean access=listeners!=null&&listeners.contains(getPackageName()+"/");try(Queue q=new Queue(this)){status.setText((getSharedPreferences("state",0).getBoolean("paired",false)?"Телефон подключён":"Телефон ещё не подключён")+"\nДоступ к уведомлениям: "+(access?"включён":"выключен")+"\nВ очереди: "+q.count()+"\n"+getSharedPreferences("state",0).getString("last",""));}}
 protected void onResume(){super.onResume();if(status!=null)refresh();}
}
