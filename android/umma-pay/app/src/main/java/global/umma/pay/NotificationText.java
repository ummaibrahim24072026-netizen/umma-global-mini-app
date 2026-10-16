package global.umma.pay;
import java.util.Locale;
/** Pure text selection. Never merge alternatives: that can duplicate a payment reference. */
final class NotificationText {
 private static final java.util.regex.Pattern REF=java.util.regex.Pattern.compile("(?i)\\bUMMA\\s+\\d{1,18}\\b");
 private static final java.util.regex.Pattern UMMA=java.util.regex.Pattern.compile("(?i)\\bUMMA\\b");
 static String clean(CharSequence value){return value==null?"":value.toString().trim();}
 static String choose(CharSequence big,CharSequence normal,CharSequence[] lines){
  String a=clean(big),b=clean(normal),c="";
  if(lines!=null){StringBuilder out=new StringBuilder();for(CharSequence line:lines){if(out.length()>0)out.append('\n');out.append(clean(line));}c=out.toString();}
  for(String candidate:new String[]{a,b,c})if(REF.matcher(candidate).find())return candidate;
  for(String candidate:new String[]{a,b,c})if(UMMA.matcher(candidate).find())return candidate;
  return !a.isEmpty()?a:!b.isEmpty()?b:c;
 }
 static boolean allowed(String full){String lower=full.toLowerCase(Locale.ROOT);return UMMA.matcher(full).find()&&!lower.contains("otp")&&full.length()<=12000;}
 static boolean recent(long posted,long now){return posted>=now-86400000L&&posted<=now+120000L;}
}
