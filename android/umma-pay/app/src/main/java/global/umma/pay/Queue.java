package global.umma.pay;
import android.content.*;
import android.database.sqlite.*;
import android.database.Cursor;
import org.json.JSONObject;
final class Queue extends SQLiteOpenHelper {
 Queue(Context c){super(c,"notifications.db",null,1);}
 public void onCreate(SQLiteDatabase d){d.execSQL("CREATE TABLE queue(id TEXT PRIMARY KEY,body TEXT NOT NULL)");}
 public void onUpgrade(SQLiteDatabase d,int a,int b){}
 void put(String id,JSONObject body){ContentValues v=new ContentValues();v.put("id",id);v.put("body",body.toString());getWritableDatabase().insertWithOnConflict("queue",null,v,SQLiteDatabase.CONFLICT_IGNORE);}
 String[] next(){try(Cursor c=getReadableDatabase().rawQuery("SELECT id,body FROM queue ORDER BY rowid LIMIT 1",null)){return c.moveToFirst()?new String[]{c.getString(0),c.getString(1)}:null;}}
 void remove(String id){getWritableDatabase().delete("queue","id=?",new String[]{id});}
 int count(){try(Cursor c=getReadableDatabase().rawQuery("SELECT count(*) FROM queue",null)){c.moveToFirst();return c.getInt(0);}}
}
