#include <WiFi.h>
#include <Wire.h>
#include <WebServer.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <Firebase_ESP_Client.h>
#include "addons/TokenHelper.h"
#include <time.h>
#include <Preferences.h>

// ---------- OLED ----------
#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1
#define SDA_PIN 21
#define SCL_PIN 22

Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

// ---------- SENSOR ----------
#define MQ_PIN 34

// ---------- WIFI ----------
const char* ssid="Jeevan";
const char* password="helloworld";

// ---------- FIREBASE ----------
#define API_KEY "AIzaSyDrxHNcJec-7K8p75pnq3ED6b1FPZtOtO8"
#define PROJECT_ID "carbocoin-fb2a2"
#define DEVICE_EMAIL "device@carbocoin.com"
#define DEVICE_PASSWORD "esp32device123"

// ---------- COMPANY ----------
String companyId="";
String sensorId="sensor-1";

// ---------- FLASH STORAGE ----------
Preferences prefs;

// ---------- FIREBASE ----------
FirebaseData fbdo;
FirebaseAuth auth;
FirebaseConfig config;

// ---------- WEB ----------
WebServer server(80);

// ---------- MODES ----------
enum Mode{SENSOR_MODE,SIMULATION_MODE};
Mode currentMode=SENSOR_MODE;

// ---------- DATA ----------
int rawValue=0;
float ppm=0;
float tonsPerMinute=0;
float emissionKg=0;
String lastLog="";

// ---------- TIMING ----------
unsigned long lastSend=0;
const unsigned long interval=60000;

// ---------- SIMULATION ----------
float targetTons10=100;
float minutePlan[10];
int currentWindow=-1;

// ---------- CONSTANTS ----------
const float FLOW_NM3_S=10000;
const float MW_CO2=44.01;
const float MOLAR_VOLUME=24.45;


// ---------- SAVE COMPANY ----------
void saveCompanyId(String newId){

prefs.begin("config",false);

prefs.putString("companyId",newId);

prefs.end();

companyId=newId;

Serial.println("Company updated: "+companyId);
}


// ---------- WIFI ----------
void ensureWiFi(){
  if(WiFi.status()==WL_CONNECTED) return;

  WiFi.begin(ssid,password);

  while(WiFi.status()!=WL_CONNECTED){
    delay(500);
    Serial.print(".");
  }

  Serial.println("\nWiFi connected");
}

// ---------- TIME ----------
void syncTime(){
  configTime(0,0,"pool.ntp.org","time.nist.gov");
  time_t now=0;

  while(now<1600000000){
    time(&now);
    delay(500);
  }

  Serial.println("Time synced");
}

// ---------- SIM PLAN ----------
void buildWindowPlan(){

  targetTons10=random(8800,11000)/100.0;

  float weights[10];
  float sum=0;

  for(int i=0;i<10;i++){
    weights[i]=random(1,100)/100.0+0.1;
    sum+=weights[i];
  }

  for(int i=0;i<10;i++){
    minutePlan[i]=(weights[i]/sum)*targetTons10;
  }
}

// ---------- CONVERT ----------
float tonsToPPM(float tons){

  float kgPerS=(tons*1000)/60.0;
  float mgPerM3=(kgPerS*1000000)/FLOW_NM3_S;

  return (mgPerM3*MOLAR_VOLUME)/MW_CO2;
}

// ---------- SENSOR ----------
int readSensor(){

  int sum=0;

  for(int i=0;i<10;i++){
    sum+=analogRead(MQ_PIN);
    delay(5);
  }

  return sum/10;
}

// ---------- EMISSION ----------
void generateEmission(){

  unsigned long now=millis();

  int window=now/600000;
  int minuteOffset=(now%600000)/60000;

  if(window!=currentWindow){
    currentWindow=window;
    buildWindowPlan();
  }

  if(currentMode==SENSOR_MODE){
    rawValue=readSensor();
    tonsPerMinute=5+((float)rawValue/1000.0)*10;
  }
  else{
    tonsPerMinute=minutePlan[minuteOffset];
  }

  ppm=tonsToPPM(tonsPerMinute);
  emissionKg=tonsPerMinute*1000;

  lastLog="ppm="+String(ppm,2)+" tons="+String(tonsPerMinute,2);
}

// ---------- FIRESTORE ----------
void sendToFirestore(){

  ensureWiFi();

  time_t now;
  time(&now);

  if(now<1600000000){
    Serial.println("Time invalid");
    return;
  }

  long long timestampMs=((long long)now)*1000LL;

  char iso[30];
  strftime(iso,sizeof(iso),"%Y-%m-%dT%H:%M:%SZ",gmtime(&now));

  FirebaseJson content;

  content.set("fields/emission/doubleValue",ppm);
  content.set("fields/emissionKg/doubleValue",emissionKg);
  content.set("fields/sensorId/stringValue",sensorId);
  content.set("fields/unit/stringValue","ppm");
  content.set("fields/timestamp/stringValue",iso);
  content.set("fields/timestampMs/integerValue",timestampMs);

  String path="emission/"+companyId+"/readings";

  bool ok=Firebase.Firestore.createDocument(
    &fbdo,PROJECT_ID,"",path.c_str(),content.raw()
  );

  if(ok) Serial.println("Emission stored");
  else{
    Serial.print("Firestore error: ");
    Serial.println(fbdo.errorReason());
  }
}

// ---------- OLED ----------
void drawOLED(){

  display.clearDisplay();

  display.setTextSize(1);
  display.setCursor(0,0);
  display.print("Carbon Monitor");

  display.setTextSize(2);
  display.setCursor(0,15);
  display.print((int)ppm);
  display.print("ppm");

  display.setTextSize(1);

  display.setCursor(0,45);
  display.print("RAW:");
  display.print(rawValue);

  display.setCursor(70,45);
  display.print("T:");
  display.print(tonsPerMinute,1);

  display.display();
}

// ---------- WEB ----------
void handleRoot(){

String page=
"<html><body style='background:#0f172a;color:white;text-align:center'>"
"<h2>Carbon Monitor</h2>"
"<p>Company:"+companyId+"</p>"
"<input id='cid' placeholder='Company ID'>"
"<button onclick=\"fetch('/setCompany?id='+cid.value)\">Update</button>"
"<p>Mode:<span id=m></span></p>"
"<p>RAW:<span id=r></span></p>"
"<p>PPM:<span id=p></span></p>"
"<p>Tons:<span id=t></span></p>"
"<button onclick=\"fetch('/sensor')\">Sensor</button>"
"<button onclick=\"fetch('/simulate')\">Sim</button>"
"<script>"
"function u(){fetch('/data').then(r=>r.json()).then(d=>{"
"m.innerText=d.mode;r.innerText=d.raw;p.innerText=d.ppm;t.innerText=d.tons})}"
"setInterval(u,1000);u();"
"</script>"
"</body></html>";

server.send(200,"text/html",page);
}

void handleData(){

String json="{";

json+="\"mode\":\""+String(currentMode==SENSOR_MODE?"Sensor":"Sim")+"\",";
json+="\"raw\":"+String(rawValue)+",";
json+="\"ppm\":"+String(ppm,2)+",";
json+="\"tons\":"+String(tonsPerMinute,2);

json+="}";

server.send(200,"application/json",json);
}

// ---------- WEB COMPANY UPDATE ----------
void setCompany(){

if(server.hasArg("id")){
String newId=server.arg("id");
saveCompanyId(newId);
server.send(200,"text/plain","Company Updated");
}
else{
server.send(400,"text/plain","Missing ID");
}

}

// ---------- MODE ----------
void setSensor(){currentMode=SENSOR_MODE;server.send(200,"text/plain","ok");}
void setSim(){currentMode=SIMULATION_MODE;server.send(200,"text/plain","ok");}

// ---------- SETUP ----------
void setup(){

Serial.begin(115200);

analogSetAttenuation(ADC_11db);

Wire.begin(SDA_PIN,SCL_PIN);

display.begin(SSD1306_SWITCHCAPVCC,0x3C);
display.clearDisplay();
display.setTextColor(WHITE);

ensureWiFi();

syncTime();

// load company id
prefs.begin("config",true);
companyId=prefs.getString("companyId","b1rsJjK5dvXa4uWLBFH5Px6ZCZe2");
prefs.end();

config.api_key=API_KEY;
auth.user.email=DEVICE_EMAIL;
auth.user.password=DEVICE_PASSWORD;

Firebase.begin(&config,&auth);
Firebase.reconnectWiFi(true);

fbdo.setBSSLBufferSize(1024,512);

server.on("/",handleRoot);
server.on("/data",handleData);
server.on("/sensor",setSensor);
server.on("/simulate",setSim);
server.on("/setCompany",setCompany);

server.begin();
}

// ---------- LOOP ----------
void loop(){

server.handleClient();

generateEmission();

drawOLED();

if(millis()-lastSend>=interval){
sendToFirestore();
lastSend=millis();
}

delay(1000);
}