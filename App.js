import { useState, useEffect, useCallback, useRef } from "react";
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  Modal, Alert, Platform, StatusBar, BackHandler, SafeAreaView, Switch, Dimensions, PanResponder, Animated, KeyboardAvoidingView
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Notifications from "expo-notifications";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";

// Navigationsleisten-Höhe für Android
const _sh = Dimensions.get("screen").height;
const _wh = Dimensions.get("window").height;
const NAV_BAR_H = Platform.OS === "android" ? Math.max(48, _sh - _wh - (StatusBar.currentHeight || 0)) : 0;

// Benachrichtigungen auch im Vordergrund anzeigen
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Android Notification Channel einrichten
async function setupNotifChannel() {
  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("lottes-reminders", {
      name: "Lotte's Erinnerungen",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 300, 200, 300],
      lightColor: "#4caf50",
      sound: "default",
      enableLights: true,
      enableVibrate: true,
      showBadge: true,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
    });
  }
}
setupNotifChannel();

async function scheduleNotif(reminder) {
  try {
    if (!reminder.reminderDate) return null;
    const [y,m,d] = reminder.reminderDate.split("-").map(Number);
    const [h,min] = reminder.reminderTime ? reminder.reminderTime.split(":").map(Number) : [8,0];
    const fireDate = new Date(y, m-1, d, h, min, 0);
    if (fireDate.getTime() - Date.now() <= 0) return null;

    // Trigger type — SDK 51+ braucht expliziten type
    const triggerType = Notifications.SchedulableTriggerInputTypes
      ? Notifications.SchedulableTriggerInputTypes.DATE
      : "date";

    return await Notifications.scheduleNotificationAsync({
      content: {
        title: "🔔 " + reminder.title,
        body: "Termin: " + fmtDE(reminder.date) + (reminder.time ? " · " + reminder.time + " Uhr" : ""),
        sound: "default",
        color: "#4caf50",
        vibrate: [0, 300, 200, 300],
      },
      trigger: {
        type: triggerType,
        date: fireDate,
        channelId: "lottes-reminders",
      },
    });
  } catch(e) { return null; }
}

async function cancelNotif(notifId) {
  if (notifId) { try { await Notifications.cancelScheduledNotificationAsync(notifId); } catch {} }
}

const KEYS = { cl:"lo_checklists", sh:"lo_shopping", master:"lo_master", rm:"lo_reminders", theme:"lo_theme" };
async function loadData(k) { try { const v=await AsyncStorage.getItem(k); return v?JSON.parse(v):null; } catch { return null; } }
async function saveData(k,v) { try { await AsyncStorage.setItem(k,JSON.stringify(v)); } catch {} }

const DE_MONTHS=["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];
const DE_DAYS_S=["Mo","Di","Mi","Do","Fr","Sa","So"];
const DE_DAYS_F=["Montag","Dienstag","Mittwoch","Donnerstag","Freitag","Samstag","Sonntag"];
const fmtISO=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
const todayISO=()=>fmtISO(new Date());
const fmtDE=iso=>{if(!iso)return"Datum wählen…";const d=new Date(iso+"T00:00:00");return`${d.getDate()}. ${DE_MONTHS[d.getMonth()]} ${d.getFullYear()}`;};
const subDays=(iso,n)=>{const d=new Date(iso+"T00:00:00");d.setDate(d.getDate()-n);return fmtISO(d);};
const uid=()=>String(Date.now())+String(Math.floor(Math.random()*9999));
const DEFAULT_MASTER=["Brot","Butter","Käse","Wurst","Milch","Eier","Äpfel","Birnen","Bananen","Tomaten","Gurken","Paprika","Salat","Zwiebeln","Knoblauch","Kartoffeln","Nudeln","Reis","Mehl","Zucker","Salz","Pfeffer","Öl","Essig","Kaffee","Tee","Wasser","Saft","Bier","Wein","Chips","Kekse","Schokolade","Joghurt","Quark","Sahne","Senf","Ketchup","Mayonnaise","Marmelade"];

const DARK={bg:"#0f1a0f",bg2:"#1a2a1a",bg3:"#263826",bg4:"#1e2a1e",card:"#263826",border:"#3a5c3a",border2:"#2a3d2a",accent:"#4caf50",orange:"#ff9800",red:"#c62828",text:"#d4edcc",text2:"#a8d5a2",text3:"#7aab74",text4:"#5a8a5a",text5:"#4a6e4a",shadow:"transparent",statusBar:"light-content"};
const LIGHT={bg:"#fdf6f0",bg2:"#fff9f5",bg3:"#ffffff",bg4:"#fef0e8",card:"#ffffff",border:"#e8d5c8",border2:"#f0e0d5",accent:"#e8734a",orange:"#f0a030",red:"#e05555",text:"#2d1f14",text2:"#5a3825",text3:"#8a6050",text4:"#b08878",text5:"#c8a898",shadow:"#b47858",statusBar:"dark-content"};

function Btn({C,onPress,label,variant,style,disabled,small,icon}){const v=variant||"primary";const bg=v==="primary"?C.accent:v==="danger"?C.red:C.bg4;const textColor=v==="ghost"?C.text3:"#fff";const py=small?7:11;const px=small?14:20;const fs=small?13:14;return(<TouchableOpacity onPress={onPress} disabled={disabled} activeOpacity={0.7} style={[{flexDirection:"row",alignItems:"center",gap:5,paddingVertical:py,paddingHorizontal:px,borderRadius:12,backgroundColor:bg,borderWidth:v==="ghost"?1.5:0,borderColor:C.border,opacity:disabled?0.45:1},style]}>{icon&&<Text style={{fontSize:fs}}>{icon}</Text>}<Text style={{color:textColor,fontWeight:"700",fontSize:fs}}>{label}</Text></TouchableOpacity>);}
function Inp({C,value,onChangeText,placeholder,onSubmitEditing,style,multiline}){return(<TextInput value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor={C.text5} onSubmitEditing={onSubmitEditing} multiline={multiline} returnKeyType="done" blurOnSubmit={true} style={[{backgroundColor:C.bg4,borderWidth:1.5,borderColor:C.border,borderRadius:12,paddingHorizontal:13,paddingVertical:10,color:C.text,fontSize:14,flex:1},style]}/>);}
function SectionHeader({C,title,onAdd,addLabel}){return(<View style={{flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginBottom:18}}><Text style={{color:C.text,fontSize:20,fontWeight:"800"}}>{title}</Text><Btn C={C} small label={addLabel||"+ Neu"} onPress={onAdd}/></View>);}
function EmptyState({C,emoji,text,sub}){return(<View style={{alignItems:"center",paddingVertical:50}}><Text style={{fontSize:50}}>{emoji}</Text><Text style={{color:C.text4,fontSize:15,marginTop:12,fontWeight:"600"}}>{text}</Text>{sub&&<Text style={{color:C.text5,fontSize:12,marginTop:4}}>{sub}</Text>}</View>);}
function FLabel({C,text}){return(<Text style={{color:C.text3,fontSize:11,fontWeight:"700",marginBottom:6,marginTop:2,textTransform:"uppercase",letterSpacing:0.5}}>{text}</Text>);}

function AppModal({C,visible,title,onClose,children}){
  return(
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS==="ios"?"padding":"height"} style={{flex:1}}>
        <TouchableOpacity style={{flex:1,backgroundColor:"rgba(0,0,0,0.45)"}} activeOpacity={1} onPress={onClose}>
          <View style={{flex:1}}/>
          <TouchableOpacity activeOpacity={1}>
            <View style={{backgroundColor:C.bg3,borderTopLeftRadius:20,borderTopRightRadius:20,
              borderWidth:1,borderColor:C.border,paddingHorizontal:20,paddingTop:20,paddingBottom:36,maxHeight:"92%"}}>
              <View style={{flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
                <Text style={{color:C.text,fontSize:17,fontWeight:"800"}}>{title}</Text>
                <TouchableOpacity onPress={onClose}><Text style={{color:C.text3,fontSize:22}}>✕</Text></TouchableOpacity>
              </View>
              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>{children}</ScrollView>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Drag & Drop Hook ─────────────────────────────────────────────────────────
function useDrag(items, onReorder) {
  const [displayItems, setDisplayItems] = useState(items);
  const drag = useRef(null);
  const ITEM_H = 52;

  useEffect(() => {
    if (!drag.current) setDisplayItems(items);
  }, [items]);

  function makeHandlers(itemId) {
    return {
      onStartShouldSetResponder: () => true,
      onMoveShouldSetResponder: () => true,
      onResponderGrant: (e) => {
        const fromIdx = items.findIndex(i => i.id === itemId);
        drag.current = { fromIdx, toIdx: fromIdx, startY: e.nativeEvent.pageY };
      },
      onResponderMove: (e) => {
        if (!drag.current) return;
        const dy = e.nativeEvent.pageY - drag.current.startY;
        const newTo = Math.max(0, Math.min(items.length - 1, drag.current.fromIdx + Math.round(dy / ITEM_H)));
        if (newTo !== drag.current.toIdx) {
          drag.current.toIdx = newTo;
          const tmp = [...items];
          const [mv] = tmp.splice(drag.current.fromIdx, 1);
          tmp.splice(newTo, 0, mv);
          setDisplayItems([...tmp]);
        }
      },
      onResponderRelease: () => {
        if (drag.current && drag.current.fromIdx !== drag.current.toIdx) {
          const tmp = [...items];
          const [mv] = tmp.splice(drag.current.fromIdx, 1);
          tmp.splice(drag.current.toIdx, 0, mv);
          onReorder(tmp);
        }
        drag.current = null;
      },
      onResponderTerminate: () => { drag.current = null; setDisplayItems(items); },
    };
  }

  function isDragging(itemId) {
    if (!drag.current) return false;
    const it = items[drag.current.fromIdx]; return it && it.id === itemId;
  }

  return { displayItems, makeHandlers, isDragging, isDragActive: !!drag.current };
}

// Vollbild-Modal für komplexe Formulare
function FullModal({C, visible, title, onClose, children}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{flex:1, backgroundColor:"rgba(0,0,0,0.55)"}}>
        <View style={{
          position:"absolute", top:24, bottom:24, left:10, right:10,
          backgroundColor:C.bg3, borderRadius:20,
          borderWidth:1, borderColor:C.border, overflow:"hidden",
        }}>
          {/* Header */}
          <View style={{flexDirection:"row",justifyContent:"space-between",alignItems:"center",
            padding:16,borderBottomWidth:1,borderBottomColor:C.border,backgroundColor:C.bg3}}>
            <Text style={{color:C.text,fontSize:17,fontWeight:"800"}}>{title}</Text>
            <TouchableOpacity onPress={onClose} style={{padding:6,backgroundColor:C.bg4,borderRadius:10}}>
              <Text style={{color:C.text3,fontSize:18}}>✕</Text>
            </TouchableOpacity>
          </View>
          {/* Scrollbarer Inhalt */}
          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={true}
            style={{flex:1}}
            contentContainerStyle={{padding:16,paddingBottom:24}}>
            {children}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// Separates Popup für eigenes Erinnerungsdatum + Uhrzeit
function ReminderDatePopup({C, visible, onClose, date, onDateChange, time, onTimeChange}) {
  const [showTimePicker, setShowTimePicker] = useState(false);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{flex:1,backgroundColor:"rgba(0,0,0,0.6)",justifyContent:"center",padding:12}}>
        <View style={{backgroundColor:C.bg3,borderRadius:20,borderWidth:1.5,
          borderColor:C.border,maxHeight:"88%",overflow:"hidden"}}>
          <View style={{flexDirection:"row",justifyContent:"space-between",alignItems:"center",
            padding:16,borderBottomWidth:1,borderBottomColor:C.border}}>
            <Text style={{color:C.text,fontSize:17,fontWeight:"800"}}>🔔 Erinnerungsdatum</Text>
            <TouchableOpacity onPress={onClose} style={{padding:6,backgroundColor:C.bg4,borderRadius:10}}>
              <Text style={{color:C.text3,fontSize:18}}>✕</Text>
            </TouchableOpacity>
          </View>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
            contentContainerStyle={{padding:16,paddingBottom:24}}>
            <CalendarPicker C={C} value={date} onChange={onDateChange} onClose={()=>{}}/>
            <View style={{height:16}}/>
            <FLabel C={C} text="Uhrzeit der Erinnerung"/>
            <TouchableOpacity onPress={()=>setShowTimePicker(v=>!v)}
              style={{backgroundColor:C.bg4,borderWidth:1.5,borderColor:showTimePicker?C.accent:C.border,
                borderRadius:12,padding:11,flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
              <Text style={{color:time?C.text:C.text5,fontSize:14,fontWeight:time?"700":"400"}}>{time||"Uhrzeit wählen…"}</Text>
              <Text>⏰</Text>
            </TouchableOpacity>
            {showTimePicker&&(
              <View style={{backgroundColor:C.bg4,borderRadius:14,padding:14,borderWidth:1.5,borderColor:C.accent,marginBottom:8}}>
                <TimePicker C={C} value={time||"08:00"} onChange={onTimeChange}/>
                <Btn C={C} label="✓ Zeit übernehmen" onPress={()=>setShowTimePicker(false)} style={{marginTop:10,alignSelf:"stretch",justifyContent:"center"}}/>
              </View>
            )}
            {date&&(
              <View style={{backgroundColor:C.accent+"18",borderRadius:12,padding:12,marginTop:8,borderWidth:1,borderColor:C.accent}}>
                <Text style={{color:C.text,fontSize:13,fontWeight:"700",textAlign:"center"}}>
                  🔔 Erinnerung: {date ? new Date(date+"T00:00:00").toLocaleDateString("de-DE",{weekday:"long",day:"numeric",month:"long",year:"numeric"}) : ""}
                  {time ? "\n⏰ "+time+" Uhr" : ""}
                </Text>
              </View>
            )}
            <Btn C={C} label="✓ Übernehmen" onPress={onClose} style={{marginTop:14,alignSelf:"stretch",justifyContent:"center"}}/>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function Card({C,title,sub,progress,accentColor,onPress,onDelete}){return(<View style={{width:"50%",padding:5}}><View style={{backgroundColor:C.card,borderRadius:16,borderWidth:1.5,borderColor:C.border,borderTopWidth:3.5,borderTopColor:accentColor,elevation:2,overflow:"hidden"}}><View style={{flexDirection:"row"}}><TouchableOpacity onPress={onPress} activeOpacity={0.8} style={{flex:1,padding:12,paddingRight:6}}><Text style={{color:C.text,fontWeight:"800",fontSize:13,marginBottom:3}}>{title}</Text><Text style={{color:C.text4,fontSize:11,marginBottom:progress!=null?8:0}}>{sub}</Text>{progress!=null&&(<View style={{height:4,backgroundColor:C.border,borderRadius:2,overflow:"hidden"}}><View style={{height:"100%",width:`${progress}%`,backgroundColor:accentColor}}/></View>)}</TouchableOpacity><TouchableOpacity onPress={onDelete} activeOpacity={0.7} style={{width:42,alignItems:"center",justifyContent:"center",borderLeftWidth:1,borderLeftColor:C.border,backgroundColor:C.bg4}}><Text style={{fontSize:17}}>🗑</Text></TouchableOpacity></View></View></View>);}

function CalendarPicker({C,value,onChange,onClose}){const todStr=todayISO();const init=value?new Date(value+"T00:00:00"):new Date();const[view,setView]=useState("month");const[yr,setYr]=useState(init.getFullYear());const[mo,setMo]=useState(init.getMonth());const[wkOff,setWkOff]=useState(0);const pick=iso=>{onChange(iso);onClose();};const navMo=dir=>{let m=mo+dir,y=yr;if(m<0){m=11;y--;}if(m>11){m=0;y++;}setMo(m);setYr(y);};const VTab=({v,l})=>(<TouchableOpacity onPress={()=>setView(v)} style={{flex:1,paddingVertical:9,alignItems:"center",borderBottomWidth:2.5,borderBottomColor:view===v?C.accent:"transparent",backgroundColor:view===v?C.bg4:"transparent"}}><Text style={{color:view===v?C.accent:C.text4,fontSize:12,fontWeight:"700"}}>{l}</Text></TouchableOpacity>);const renderMonth=()=>{const off=(new Date(yr,mo,1).getDay()+6)%7;const days=[];for(let i=-off;i<42-off;i++)days.push(new Date(yr,mo,1+i));return(<View><View style={{flexDirection:"row",marginBottom:4}}>{DE_DAYS_S.map(d=>(<Text key={d} style={{flex:1,textAlign:"center",color:C.text4,fontSize:10,fontWeight:"700",paddingVertical:3}}>{d}</Text>))}</View><View style={{flexDirection:"row",flexWrap:"wrap"}}>{days.map((d,i)=>{const iso=fmtISO(d),inM=d.getMonth()===mo,sel=iso===value,tod=iso===todStr;return(<TouchableOpacity key={i} onPress={()=>pick(iso)} style={{width:"14.28%",aspectRatio:1,alignItems:"center",justifyContent:"center",borderRadius:100,backgroundColor:sel?C.accent:tod?C.bg4:"transparent",borderWidth:tod&&!sel?2:0,borderColor:C.accent}}><Text style={{fontSize:12,fontWeight:sel||tod?"700":"400",color:sel?"#fff":inM?C.text:C.text5}}>{d.getDate()}</Text></TouchableOpacity>);})}</View></View>);};const renderWeek=()=>{const base=value?new Date(value+"T00:00:00"):new Date();const mon=new Date(base);mon.setDate(base.getDate()-((base.getDay()+6)%7)+wkOff*7);const week=Array.from({length:7},(_,i)=>{const d=new Date(mon);d.setDate(mon.getDate()+i);return d;});return(<View><View style={{flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginBottom:10}}><TouchableOpacity onPress={()=>setWkOff(w=>w-1)} style={{padding:8}}><Text style={{color:C.text3,fontSize:22}}>‹</Text></TouchableOpacity><Text style={{color:C.text2,fontSize:12,fontWeight:"700"}}>{mon.getDate()}. {DE_MONTHS[mon.getMonth()].slice(0,3)} – {week[6].getDate()}. {DE_MONTHS[week[6].getMonth()].slice(0,3)} {week[6].getFullYear()}</Text><TouchableOpacity onPress={()=>setWkOff(w=>w+1)} style={{padding:8}}><Text style={{color:C.text3,fontSize:22}}>›</Text></TouchableOpacity></View>{week.map((d,i)=>{const iso=fmtISO(d),sel=iso===value,tod=iso===todStr;return(<TouchableOpacity key={i} onPress={()=>pick(iso)} style={{flexDirection:"row",alignItems:"center",gap:12,padding:10,borderRadius:12,marginBottom:5,backgroundColor:sel?C.accent+"22":tod?C.bg4:C.bg2,borderWidth:1.5,borderColor:sel?C.accent:tod?C.border:"transparent"}}><View style={{width:36,height:36,borderRadius:18,backgroundColor:sel?C.accent:tod?C.border2:C.bg4,alignItems:"center",justifyContent:"center"}}><Text style={{color:sel?"#fff":C.text,fontSize:14,fontWeight:"700"}}>{d.getDate()}</Text></View><View style={{flex:1}}><Text style={{color:sel?C.accent:C.text,fontSize:13,fontWeight:sel?"700":"500"}}>{DE_DAYS_F[i]}</Text><Text style={{color:C.text4,fontSize:11}}>{d.getDate()}. {DE_MONTHS[d.getMonth()]} {d.getFullYear()}</Text></View>{tod&&(<View style={{backgroundColor:C.accent+"22",paddingHorizontal:8,paddingVertical:3,borderRadius:10}}><Text style={{color:C.accent,fontSize:10,fontWeight:"700"}}>HEUTE</Text></View>)}</TouchableOpacity>);})}</View>);};const renderYear=()=>(<View style={{flexDirection:"row",flexWrap:"wrap",padding:4}}>{DE_MONTHS.map((m,mi)=>{const sd=value?new Date(value+"T00:00:00"):null;const hasSel=sd&&sd.getFullYear()===yr&&sd.getMonth()===mi;const hasTod=new Date().getFullYear()===yr&&new Date().getMonth()===mi;return(<TouchableOpacity key={mi} onPress={()=>{setMo(mi);setView("month");}} style={{width:"30%",margin:"1.66%",padding:11,borderRadius:12,alignItems:"center",backgroundColor:hasSel?C.accent:hasTod?C.bg4:C.bg2,borderWidth:1.5,borderColor:hasSel?C.accent:hasTod?C.border:"transparent"}}><Text style={{color:hasSel?"#fff":C.text,fontSize:13,fontWeight:hasSel?"700":"500"}}>{m.slice(0,3)}</Text></TouchableOpacity>);})}</View>);const renderDay=()=>{const d=value?new Date(value+"T00:00:00"):new Date();return(<View style={{alignItems:"center",paddingVertical:12}}><Text style={{color:C.text4,fontSize:12,marginBottom:4}}>{DE_DAYS_F[(d.getDay()+6)%7]}</Text><Text style={{color:C.text,fontSize:56,fontWeight:"800",lineHeight:60}}>{d.getDate()}</Text><Text style={{color:C.text3,fontSize:16,marginTop:6,marginBottom:16}}>{DE_MONTHS[d.getMonth()]} {d.getFullYear()}</Text><View style={{flexDirection:"row",gap:10,flexWrap:"wrap",justifyContent:"center"}}><Btn C={C} small variant="ghost" label="‹ Vorher" onPress={()=>{const n=new Date(d);n.setDate(d.getDate()-1);onChange(fmtISO(n));}}/><Btn C={C} small label="Heute" onPress={()=>pick(todayISO())}/><Btn C={C} small variant="ghost" label="Weiter ›" onPress={()=>{const n=new Date(d);n.setDate(d.getDate()+1);onChange(fmtISO(n));}}/></View>{value&&<Btn C={C} label="✓ Datum übernehmen" onPress={onClose} style={{marginTop:14,alignSelf:"stretch",justifyContent:"center"}}/>}</View>);};return(<View style={{backgroundColor:C.bg3,borderWidth:1.5,borderColor:C.border,borderRadius:16,overflow:"hidden",marginTop:8}}><View style={{flexDirection:"row",borderBottomWidth:1,borderBottomColor:C.border}}><VTab v="day" l="Tag"/><VTab v="week" l="Woche"/><VTab v="month" l="Monat"/><VTab v="year" l="Jahr"/></View>{(view==="month"||view==="year")&&(<View style={{flexDirection:"row",alignItems:"center",justifyContent:"space-between",paddingHorizontal:8,paddingTop:8,paddingBottom:4}}><TouchableOpacity onPress={()=>view==="year"?setYr(y=>y-1):navMo(-1)} style={{padding:8}}><Text style={{color:C.text3,fontSize:22}}>‹</Text></TouchableOpacity><TouchableOpacity onPress={()=>setView(view==="month"?"year":"month")}><Text style={{color:C.text,fontSize:14,fontWeight:"700"}}>{view==="month"?`${DE_MONTHS[mo]} ${yr}`:yr}</Text></TouchableOpacity><TouchableOpacity onPress={()=>view==="year"?setYr(y=>y+1):navMo(1)} style={{padding:8}}><Text style={{color:C.text3,fontSize:22}}>›</Text></TouchableOpacity></View>)}<View style={{padding:view==="day"?14:8}}>{view==="month"&&renderMonth()}{view==="week"&&renderWeek()}{view==="year"&&renderYear()}{view==="day"&&renderDay()}</View>{value&&view!=="day"&&(<View style={{flexDirection:"row",justifyContent:"space-between",alignItems:"center",padding:10,borderTopWidth:1,borderTopColor:C.border}}><Text style={{color:C.text3,fontSize:12}}>Gewählt: <Text style={{color:C.text,fontWeight:"700"}}>{fmtDE(value)}</Text></Text><Btn C={C} small label="✓ OK" onPress={onClose}/></View>)}</View>);}

// ─── Time Picker (▲/▼ Rad) ───────────────────────────────────────────────────
function TimePicker({C, value, onChange}) {
  const parts = value ? value.split(":") : ["8","0"];
  const [hr,  setHr]  = useState(parseInt(parts[0]) || 8);
  const [min, setMin] = useState(parseInt(parts[1]) || 0);
  const upd = (h, m) => onChange(String(h).padStart(2,"0")+":"+String(m).padStart(2,"0"));
  const addH = d => { const h=((hr+d+24)%24); setHr(h); upd(h,min); };
  const addM = d => { const m=((min+d+60)%60); setMin(m); upd(hr,m); };
  const Col = ({val, onUp, onDown, label}) => (
    <View style={{alignItems:"center",gap:5}}>
      <TouchableOpacity onPress={onUp} style={{backgroundColor:C.bg4,borderRadius:10,paddingVertical:9,paddingHorizontal:18,borderWidth:1.5,borderColor:C.border}}>
        <Text style={{color:C.text3,fontSize:16,fontWeight:"700"}}>▲</Text>
      </TouchableOpacity>
      <View style={{backgroundColor:C.accent+"22",borderRadius:12,paddingVertical:10,paddingHorizontal:18,borderWidth:2,borderColor:C.accent,minWidth:58,alignItems:"center"}}>
        <Text style={{color:C.text,fontSize:26,fontWeight:"800"}}>{String(val).padStart(2,"0")}</Text>
      </View>
      <TouchableOpacity onPress={onDown} style={{backgroundColor:C.bg4,borderRadius:10,paddingVertical:9,paddingHorizontal:18,borderWidth:1.5,borderColor:C.border}}>
        <Text style={{color:C.text3,fontSize:16,fontWeight:"700"}}>▼</Text>
      </TouchableOpacity>
      <Text style={{color:C.text4,fontSize:10,fontWeight:"700",textTransform:"uppercase"}}>{label}</Text>
    </View>
  );
  return (
    <View style={{alignItems:"center",paddingVertical:8}}>
      <View style={{backgroundColor:C.bg4,borderRadius:14,paddingVertical:8,paddingHorizontal:22,borderWidth:2,borderColor:C.accent,marginBottom:16}}>
        <Text style={{color:C.text,fontSize:34,fontWeight:"800",letterSpacing:3}}>{String(hr).padStart(2,"0")}:{String(min).padStart(2,"0")}</Text>
      </View>
      <View style={{flexDirection:"row",gap:24,alignItems:"center",marginBottom:14}}>
        <Col val={hr}  onUp={()=>addH(1)}  onDown={()=>addH(-1)}  label="Stunden"/>
        <Text style={{color:C.text2,fontSize:28,fontWeight:"800",marginBottom:24}}>:</Text>
        <Col val={min} onUp={()=>addM(5)}  onDown={()=>addM(-5)} label="Min (±5)"/>
      </View>
      <View style={{flexDirection:"row",gap:7,flexWrap:"wrap",justifyContent:"center"}}>
        {[["06:00","Früh"],["08:00","Morg."],["12:00","Mitt."],["15:00","Nach."],["18:00","Aben."],["20:00","Spät"]].map(([t,l])=>(
          <TouchableOpacity key={t} onPress={()=>{const[h,m]=t.split(":");setHr(+h);setMin(+m);onChange(t);}}
            style={{backgroundColor:value===t?C.accent:C.bg4,borderRadius:9,paddingVertical:6,paddingHorizontal:9,borderWidth:1.5,borderColor:value===t?C.accent:C.border,alignItems:"center"}}>
            <Text style={{color:value===t?"#fff":C.text3,fontSize:12,fontWeight:"700"}}>{t}</Text>
            <Text style={{color:value===t?"#ffffffaa":C.text5,fontSize:9}}>{l}</Text>
          </TouchableOpacity>
        ))}
      </View>
      {value?<TouchableOpacity onPress={()=>onChange("")} style={{marginTop:10}}><Text style={{color:C.text4,fontSize:12}}>✕ Uhrzeit entfernen</Text></TouchableOpacity>:null}
    </View>
  );
}

const REPEAT_OPTIONS=[["none","Keine Wiederholung"],["1","Jährlich"],["2","Alle 2 Jahre"]];

const EMPTY_FORM={title:"",date:"",time:"",note:"",reminderType:"7",customReminder:"",reminderTime:"",repeat:"none"};
function RemindersTab({C}){
  const[reminders,setReminders]=useState([]);
  const[loaded,setLoaded]=useState(false);
  const[showForm,setShowForm]=useState(false);
  const[form,setForm]=useState(EMPTY_FORM);
  const[editId,setEditId]=useState(null);
  const[showDateCal,setShowDateCal]=useState(false);
  const[showRemCal,setShowRemCal]=useState(false);
  const[showTime,setShowTime]=useState(false);
  const[showRemTime,setShowRemTime]=useState(false);
  const[showRemDatePopup,setShowRemDatePopup]=useState(false);

  useEffect(()=>{loadData(KEYS.rm).then(d=>{if(d)setReminders(d);setLoaded(true);});},[]);

  // Benachrichtigungs-Berechtigung anfragen
  useEffect(()=>{
    (async()=>{
      const {status} = await Notifications.requestPermissionsAsync();
      if(status!=="granted"){
        Alert.alert("Benachrichtigungen","Bitte erlaube Benachrichtigungen in den Einstellungen, damit Erinnerungen auch bei gesperrtem Bildschirm erscheinen.");
      }
    })();
  },[]);
  useEffect(()=>{if(loaded)saveData(KEYS.rm,reminders);},[reminders,loaded]);
  useEffect(()=>{
    if(!loaded)return;
    const tod=todayISO();
    const due=reminders.find(r=>!r.dismissed&&r.reminderDate<=tod);
    if(due){
      const timeStr=due.time?" um "+due.time+" Uhr":"";
      Alert.alert("🔔 Erinnerung!",`${due.title}\n\nTermin: ${fmtDE(due.date)}${timeStr}`,[
        {text:"OK, verstanden",onPress:()=>setReminders(r=>r.map(x=>x.id===due.id?{...x,dismissed:true}:x))}
      ]);
    }
  },[loaded]);

  const setF=p=>setForm(f=>({...f,...p}));
  const calcRem=(date,type,custom)=>type==="custom"?custom:subDays(date,parseInt(type));
  const closeForm=()=>{setShowForm(false);setEditId(null);setShowDateCal(false);setShowRemCal(false);setShowTime(false);setShowRemTime(false);setShowRemDatePopup(false);};

  const saveReminder=async()=>{
    if(!form.title.trim()||!form.date)return;
    const reminderDate=calcRem(form.date,form.reminderType,form.customReminder);
    // Alte Benachrichtigung löschen falls Bearbeitung
    if(editId){
      const old=reminders.find(r=>r.id===editId);
      if(old&&old.notifId) await cancelNotif(old.notifId);
    }
    const entry={...form,reminderDate,dismissed:false};
    // Neue Benachrichtigung planen
    const notifId=await scheduleNotif({...entry});
    if(notifId) entry.notifId=notifId;
    if(editId){setReminders(r=>r.map(x=>x.id===editId?{...x,...entry}:x));}
    else{setReminders(r=>[...r,{id:uid(),...entry}]);}
    closeForm();
  };

  const openEdit=r=>{
    setForm({title:r.title,date:r.date,time:r.time||"",note:r.note||"",
      reminderType:r.reminderType||"7",customReminder:r.customReminder||"",
      reminderTime:r.reminderTime||"",repeat:r.repeat||"none"});
    setEditId(r.id);setShowForm(true);
  };
  const deleteR=id=>Alert.alert("Termin löschen?","Dauerhaft löschen?",[
    {text:"Abbrechen",style:"cancel"},
    {text:"Löschen",style:"destructive",onPress:async()=>{
      const r=reminders.find(x=>x.id===id);
      if(r&&r.notifId) await cancelNotif(r.notifId);
      setReminders(r=>r.filter(x=>x.id!==id));
    }},
  ]);

  const previewRem=form.date&&form.reminderType!=="custom"?calcRem(form.date,form.reminderType):"";
  const today=new Date();today.setHours(0,0,0,0);
  const sorted=[...reminders].sort((a,b)=>new Date(a.date+"T00:00:00")-new Date(b.date+"T00:00:00"));
  const repeatLabel=r=>{const f=REPEAT_OPTIONS.find(o=>o[0]===(r.repeat||"none"));return f?f[1]:"";};

  return(
    <View style={{flex:1}}>
      <SectionHeader C={C} title="Termine & Erinnerungen" addLabel="+ Neuer Termin"
        onAdd={()=>{setForm(EMPTY_FORM);setEditId(null);setShowForm(true);}}/>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {sorted.length===0&&<EmptyState C={C} emoji="📅" text="Keine Termine" sub="z.B. TÜV, Reifenwechsel…"/>}
        {sorted.map(r=>{
          const ed=new Date(r.date+"T00:00:00");ed.setHours(0,0,0,0);
          const rd=new Date(r.reminderDate+"T00:00:00");rd.setHours(0,0,0,0);
          const isPast=ed<today,isRemDue=rd<=today&&!r.dismissed,daysUntil=Math.ceil((ed-today)/86400000);
          const leftColor=isRemDue?C.accent:isPast?C.text5:daysUntil<=7?C.orange:C.accent;
          return(
            <View key={r.id} style={{backgroundColor:isPast?C.bg4:C.card,borderWidth:1.5,
              borderColor:isRemDue?C.accent:C.border,borderRadius:12,padding:9,marginBottom:6,
              borderLeftWidth:4,borderLeftColor:leftColor,elevation:isPast?0:2}}>
              <View style={{flexDirection:"row",justifyContent:"space-between",alignItems:"flex-start"}}>
                <View style={{flex:1}}>
                  <Text style={{color:isPast?C.text4:C.text,fontWeight:"700",fontSize:14,marginBottom:2,
                    textDecorationLine:isPast?"line-through":"none"}}>{r.title}</Text>
                  <Text style={{color:isPast?C.text5:C.text3,fontSize:12,marginBottom:1}}>
                    {"📅 "+new Date(r.date+"T00:00:00").toLocaleDateString("de-DE",{weekday:"short",year:"numeric",month:"long",day:"numeric"})}
                    {r.time?"  ⏰ "+r.time+" Uhr":""}
                  </Text>
                  {!isPast&&<Text style={{color:daysUntil<=7?C.orange:C.text4,fontSize:11,fontWeight:"600"}}>{daysUntil===0?"⚡ Heute!":daysUntil===1?"⚡ Morgen!":`in ${daysUntil} Tagen`}</Text>}
                  {r.repeat&&r.repeat!=="none"&&<Text style={{color:C.text4,fontSize:11,marginTop:1}}>{"🔁 "+repeatLabel(r)}</Text>}
                  {r.note?<Text style={{color:C.text3,fontSize:12,marginTop:2}}>{r.note}</Text>:null}
                  <Text style={{color:C.text5,fontSize:11,marginTop:3}}>{"🔔 "+fmtDE(r.reminderDate)+(r.reminderTime?" · "+r.reminderTime+" Uhr":"")+(r.dismissed?" ✓ bestätigt":"")}</Text>
                </View>
                <View style={{flexDirection:"row",gap:5,marginLeft:8,alignItems:"center"}}>
                  {isRemDue&&<TouchableOpacity onPress={()=>setReminders(rv=>rv.map(x=>x.id===r.id?{...x,dismissed:true}:x))}
                    style={{backgroundColor:C.accent,borderRadius:8,paddingVertical:5,paddingHorizontal:9}}>
                    <Text style={{color:"#fff",fontSize:12,fontWeight:"700"}}>OK</Text>
                  </TouchableOpacity>}
                  <TouchableOpacity onPress={()=>openEdit(r)} style={{padding:4}}><Text style={{fontSize:16}}>✏️</Text></TouchableOpacity>
                  <TouchableOpacity onPress={()=>deleteR(r.id)} style={{padding:4}}><Text style={{fontSize:16}}>🗑</Text></TouchableOpacity>
                </View>
              </View>
            </View>
          );
        })}
      </ScrollView>

      <FullModal C={C} visible={showForm} title={editId?"Termin bearbeiten":"Neuer Termin"} onClose={closeForm}>
        <FLabel C={C} text="Titel *"/>
        <Inp C={C} value={form.title} onChangeText={t=>setF({title:t})} placeholder="z.B. TÜV Hauptuntersuchung" style={{flex:0,marginBottom:12}}/>

        {/* Datum + Uhrzeit */}
        <View style={{flexDirection:"row",gap:8,marginBottom:4}}>
          <View style={{flex:1}}>
            <FLabel C={C} text="Datum *"/>
            <TouchableOpacity onPress={()=>{setShowDateCal(v=>!v);setShowTime(false);}}
              style={{backgroundColor:C.bg4,borderWidth:1.5,borderColor:showDateCal?C.accent:C.border,borderRadius:12,padding:11,flexDirection:"row",justifyContent:"space-between",alignItems:"center"}}>
              <Text style={{color:form.date?C.text:C.text5,fontSize:13}}>{fmtDE(form.date)}</Text>
              <Text>📅</Text>
            </TouchableOpacity>
          </View>
          <View style={{width:108}}>
            <FLabel C={C} text="Uhrzeit"/>
            <TouchableOpacity onPress={()=>{setShowTime(v=>!v);setShowDateCal(false);}}
              style={{backgroundColor:C.bg4,borderWidth:1.5,borderColor:showTime?C.accent:C.border,borderRadius:12,padding:11,flexDirection:"row",justifyContent:"space-between",alignItems:"center"}}>
              <Text style={{color:form.time?C.text:C.text5,fontSize:14,fontWeight:form.time?"700":"400"}}>{form.time||"--:--"}</Text>
              <Text>⏰</Text>
            </TouchableOpacity>
          </View>
        </View>
        {showDateCal&&<CalendarPicker C={C} value={form.date} onChange={d=>{setF({date:d});setShowDateCal(false);}} onClose={()=>setShowDateCal(false)}/>}
        {showTime&&(
          <View style={{backgroundColor:C.bg4,borderRadius:14,padding:14,marginTop:6,borderWidth:1.5,borderColor:C.accent}}>
            <TimePicker C={C} value={form.time} onChange={t=>setF({time:t})}/>
            <Btn C={C} label="✓ Zeit übernehmen" onPress={()=>setShowTime(false)} style={{marginTop:10,alignSelf:"stretch",justifyContent:"center"}}/>
          </View>
        )}

        <View style={{marginTop:12}}>
          <FLabel C={C} text="Notiz"/>
          <Inp C={C} value={form.note} onChangeText={t=>setF({note:t})} placeholder="Optional…" style={{flex:0,marginBottom:12}}/>
        </View>

        {/* Wiederholung */}
        <FLabel C={C} text="🔁 Wiederholung"/>
        <View style={{flexDirection:"row",flexWrap:"wrap",gap:7,marginBottom:12}}>
          {REPEAT_OPTIONS.map(([v,l])=>(
            <TouchableOpacity key={v} onPress={()=>setF({repeat:v})}
              style={{paddingVertical:7,paddingHorizontal:12,borderRadius:20,borderWidth:1.5,
                borderColor:form.repeat===v?C.accent:C.border,
                backgroundColor:form.repeat===v?C.accent:C.bg4}}>
              <Text style={{color:form.repeat===v?"#fff":C.text3,fontWeight:"700",fontSize:12}}>{l}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <FLabel C={C} text="Erinnere mich…"/>
        <View style={{flexDirection:"row",flexWrap:"wrap",gap:7,marginBottom:8}}>
          {[["1 Tag","1"],["1 Woche","7"],["1 Monat","30"],["1 Jahr","365"],["Eigenes","custom"]].map(([l,v])=>(
            <TouchableOpacity key={v} onPress={()=>setF({reminderType:v})}
              style={{paddingVertical:7,paddingHorizontal:12,borderRadius:20,borderWidth:1.5,
                borderColor:form.reminderType===v?C.accent:C.border,
                backgroundColor:form.reminderType===v?C.accent:C.bg4}}>
              <Text style={{color:form.reminderType===v?"#fff":C.text3,fontWeight:"700",fontSize:12}}>{l}</Text>
            </TouchableOpacity>
          ))}
        </View>
        {previewRem?<Text style={{color:C.text4,fontSize:12,marginBottom:8}}>Erinnerung am: {fmtDE(previewRem)}</Text>:null}

        {/* Eigenes Datum → separates Popup */}
        {form.reminderType==="custom"&&(
          <TouchableOpacity onPress={()=>setShowRemDatePopup(true)}
            style={{backgroundColor:C.bg4,borderWidth:1.5,
              borderColor:form.customReminder?C.accent:C.border,
              borderRadius:12,padding:12,flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
            <View>
              <Text style={{color:C.text4,fontSize:10,fontWeight:"700",textTransform:"uppercase",marginBottom:2}}>Erinnerungsdatum</Text>
              <Text style={{color:form.customReminder?C.text:C.text5,fontSize:14,fontWeight:form.customReminder?"700":"400"}}>
                {form.customReminder ? fmtDE(form.customReminder)+(form.reminderTime?" · "+form.reminderTime+" Uhr":"") : "Datum & Uhrzeit wählen…"}
              </Text>
            </View>
            <Text style={{fontSize:20}}>📅</Text>
          </TouchableOpacity>
        )}

        {/* Uhrzeit der Erinnerung für nicht-custom */}
        {form.reminderType!=="custom"&&(
          <View style={{marginBottom:8}}>
            <FLabel C={C} text="Uhrzeit der Erinnerung"/>
            <TouchableOpacity onPress={()=>{setShowRemTime(v=>!v);setShowTime(false);setShowDateCal(false);}}
              style={{backgroundColor:C.bg4,borderWidth:1.5,borderColor:showRemTime?C.accent:C.border,borderRadius:12,padding:11,flexDirection:"row",justifyContent:"space-between",alignItems:"center"}}>
              <Text style={{color:form.reminderTime?C.text:C.text5,fontSize:14,fontWeight:form.reminderTime?"700":"400"}}>{form.reminderTime||"Uhrzeit wählen (Standard: 08:00)"}</Text>
              <Text>⏰</Text>
            </TouchableOpacity>
            {showRemTime&&(
              <View style={{backgroundColor:C.bg4,borderRadius:14,padding:14,marginTop:6,borderWidth:1.5,borderColor:C.accent}}>
                <TimePicker C={C} value={form.reminderTime||"08:00"} onChange={t=>setF({reminderTime:t})}/>
                <Btn C={C} label="✓ Zeit übernehmen" onPress={()=>setShowRemTime(false)} style={{marginTop:10,alignSelf:"stretch",justifyContent:"center"}}/>
              </View>
            )}
          </View>
        )}

        <View style={{flexDirection:"row",gap:8,marginTop:16}}>
          <Btn C={C} label="Speichern" onPress={saveReminder} disabled={!form.title.trim()||!form.date}/>
          <Btn C={C} variant="ghost" label="Abbrechen" onPress={closeForm}/>
        </View>
      </FullModal>

      {/* Popup für eigenes Erinnerungsdatum */}
      <ReminderDatePopup
        C={C}
        visible={showRemDatePopup}
        onClose={()=>setShowRemDatePopup(false)}
        date={form.customReminder}
        onDateChange={d=>setF({customReminder:d})}
        time={form.reminderTime}
        onTimeChange={t=>setF({reminderTime:t})}
      />
    </View>
  );
}

function ChecklistTab({C}){const[lists,setLists]=useState([]);const[openId,setOpenId]=useState(null);const[showNew,setShowNew]=useState(false);const[newName,setNewName]=useState("");const[renameId,setRenameId]=useState(null);const[newItem,setNewItem]=useState("");const[editItem,setEditItem]=useState(null);const[editVal,setEditVal]=useState("");useEffect(()=>{loadData(KEYS.cl).then(d=>{if(d)setLists(d);});},[]);useEffect(()=>{const sub=BackHandler.addEventListener("hardwareBackPress",()=>{if(openId){setOpenId(null);return true;}return false;});return()=>sub.remove();},[openId]);const persist=useCallback(l=>{setLists(l);saveData(KEYS.cl,l);},[]);const createList=()=>{if(!newName.trim())return;if(renameId){persist(lists.map(l=>l.id===renameId?{...l,name:newName.trim()}:l));setRenameId(null);}else{persist([...lists,{id:uid(),name:newName.trim(),items:[]}]);}setNewName("");setShowNew(false);};const deleteList=id=>Alert.alert("Liste löschen?","Dauerhaft löschen?",[{text:"Abbrechen",style:"cancel"},{text:"Löschen",style:"destructive",onPress:()=>{persist(lists.filter(l=>l.id!==id));if(openId===id)setOpenId(null);}}]);const addItem=()=>{if(!newItem.trim()||!openId)return;persist(lists.map(l=>l.id===openId?{...l,items:[...l.items,{id:uid(),text:newItem.trim(),done:false}]}:l));setNewItem("");};const toggleItem=id=>persist(lists.map(l=>l.id===openId?{...l,items:l.items.map(i=>i.id===id?{...i,done:!i.done}:i)}:l));const deleteItem=id=>persist(lists.map(l=>l.id===openId?{...l,items:l.items.filter(i=>i.id!==id)}:l));const saveEdit=()=>{if(!editVal.trim())return;persist(lists.map(l=>l.id===openId?{...l,items:l.items.map(i=>i.id===editItem.id?{...i,text:editVal.trim()}:i)}:l));setEditItem(null);setEditVal("");};const resetAll=()=>persist(lists.map(l=>l.id===openId?{...l,items:l.items.map(i=>({...i,done:false}))}:l));const current=lists.find(l=>l.id===openId);const clDrag=useDrag(current?current.items:[],items=>persist(lists.map(l=>l.id===openId?{...l,items}:l)));if(openId&&current){const done=current.items.filter(i=>i.done).length,total=current.items.length;return(<View style={{flex:1}}><View style={{flexDirection:"row",alignItems:"center",gap:10,marginBottom:18}}><TouchableOpacity onPress={()=>setOpenId(null)} style={{backgroundColor:C.bg4,padding:8,borderRadius:10}}><Text style={{color:C.text3,fontSize:20}}>‹</Text></TouchableOpacity><Text style={{color:C.text,fontSize:20,fontWeight:"800",flex:1}}>{current.name}</Text><TouchableOpacity onPress={()=>{setNewName(current.name);setRenameId(current.id);setShowNew(true);}} style={{backgroundColor:C.bg4,padding:8,borderRadius:10}}><Text style={{fontSize:16}}>✏️</Text></TouchableOpacity></View>{total>0&&(<View style={{backgroundColor:C.bg4,borderRadius:14,padding:10,marginBottom:14,flexDirection:"row",alignItems:"center",gap:10,borderWidth:1,borderColor:C.border}}><Text style={{color:C.text3,fontSize:12,fontWeight:"700"}}>{done}/{total}</Text><View style={{flex:1,backgroundColor:C.border,borderRadius:3,height:6,overflow:"hidden"}}><View style={{height:"100%",width:`${Math.round(done/total*100)}%`,backgroundColor:C.accent}}/></View>{done>0&&<Btn C={C} variant="ghost" small label="Reset" onPress={resetAll}/>}</View>)}<View style={{flexDirection:"row",gap:8,marginBottom:14}}><Inp C={C} value={newItem} onChangeText={setNewItem} placeholder="Neuer Eintrag…" onSubmitEditing={addItem}/><Btn C={C} label="+" onPress={addItem} style={{paddingHorizontal:18,flex:0}}/></View><ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">{current.items.length===0&&<EmptyState C={C} emoji="📋" text="Noch keine Einträge"/>}{(clDrag.isDragActive?clDrag.displayItems:current.items).map((item)=>(<View key={item.id} style={{flexDirection:"row",alignItems:"center",gap:8,paddingVertical:7,paddingHorizontal:10,backgroundColor:clDrag.isDragging(item.id)?C.accent+"22":item.done?C.bg4:C.card,borderRadius:12,marginBottom:5,borderWidth:1.5,borderColor:clDrag.isDragging(item.id)?C.accent:item.done?C.border2:C.border,elevation:clDrag.isDragging(item.id)?4:item.done?0:1}}><View {...clDrag.makeHandlers(item.id)} style={{paddingHorizontal:5,paddingVertical:8}}><Text style={{color:C.text4,fontSize:16,opacity:0.6}}>☰</Text></View><TouchableOpacity onPress={()=>toggleItem(item.id)} style={{width:24,height:24,borderRadius:7,borderWidth:2,borderColor:item.done?C.accent:C.border,backgroundColor:item.done?C.accent:"transparent",alignItems:"center",justifyContent:"center"}}>{item.done&&<Text style={{color:"#fff",fontSize:13,fontWeight:"700"}}>✓</Text>}</TouchableOpacity><Text style={{flex:1,color:item.done?C.text4:C.text,fontSize:14,fontWeight:"500",textDecorationLine:item.done?"line-through":"none"}}>{item.text}</Text><TouchableOpacity onPress={()=>{setEditItem(item);setEditVal(item.text);}} style={{padding:3,opacity:0.6}}><Text style={{fontSize:16}}>✏️</Text></TouchableOpacity><TouchableOpacity onPress={()=>deleteItem(item.id)} style={{padding:3,opacity:0.6}}><Text style={{fontSize:16}}>🗑</Text></TouchableOpacity></View>))}</ScrollView><AppModal C={C} visible={!!editItem} title="Eintrag bearbeiten" onClose={()=>setEditItem(null)}><FLabel C={C} text="Text"/><Inp C={C} value={editVal} onChangeText={setEditVal} onSubmitEditing={saveEdit} style={{flex:0}}/><View style={{flexDirection:"row",gap:8,marginTop:14}}><Btn C={C} label="Speichern" onPress={saveEdit}/><Btn C={C} variant="ghost" label="Abbrechen" onPress={()=>setEditItem(null)}/></View></AppModal><FullModal C={C} visible={showNew} title={renameId?"Umbenennen":"Neue Checkliste"} onClose={()=>{setShowNew(false);setNewName("");setRenameId(null);}}><FLabel C={C} text="Listenname"/><Inp C={C} value={newName} onChangeText={setNewName} placeholder="z.B. Anhänger anhängen…" onSubmitEditing={createList} style={{flex:0}}/><View style={{flexDirection:"row",gap:8,marginTop:14}}><Btn C={C} label={renameId?"Speichern":"Erstellen"} onPress={createList}/><Btn C={C} variant="ghost" label="Abbrechen" onPress={()=>{setShowNew(false);setNewName("");setRenameId(null);}}/></View></FullModal></View>);}return(<View style={{flex:1}}><SectionHeader C={C} title="Meine Checklisten" addLabel="+ Neue Liste" onAdd={()=>{setRenameId(null);setNewName("");setShowNew(true);}}/><ScrollView showsVerticalScrollIndicator={false}>{lists.length===0&&<EmptyState C={C} emoji="📋" text="Noch keine Listen" sub='z.B. „Anhänger anhängen"'/>}<View style={{flexDirection:"row",flexWrap:"wrap",marginHorizontal:-5}}>{lists.map(list=>{const done=list.items.filter(i=>i.done).length,total=list.items.length;return<Card key={list.id} C={C} title={list.name} sub={`${total} Einträge · ${done} erledigt`} progress={total?Math.round(done/total*100):null} accentColor={C.accent} onPress={()=>setOpenId(list.id)} onDelete={()=>deleteList(list.id)}/>;})}</View></ScrollView><FullModal C={C} visible={showNew} title="Neue Checkliste" onClose={()=>{setShowNew(false);setNewName("");}}><FLabel C={C} text="Listenname"/><Inp C={C} value={newName} onChangeText={setNewName} placeholder="z.B. Anhänger anhängen…" onSubmitEditing={createList} style={{flex:0}}/><View style={{flexDirection:"row",gap:8,marginTop:14}}><Btn C={C} label="Erstellen" onPress={createList}/><Btn C={C} variant="ghost" label="Abbrechen" onPress={()=>{setShowNew(false);setNewName("");}}/>    </View></FullModal></View>);}

// ─── Mengen-Picker als scrollbare Liste ──────────────────────────────────────
function QtyPicker({C, value, onChange}) {
  const [open, setOpen] = useState(false);
  const nums = ["1","2","3","4","5","6","7","8","9"];
  return (
    <View>
      <TouchableOpacity onPress={()=>setOpen(true)}
        style={{width:68, backgroundColor:C.bg4, borderWidth:1.5,
          borderColor:C.accent, borderRadius:12,
          paddingVertical:10, paddingHorizontal:8,
          flexDirection:"row", alignItems:"center", justifyContent:"space-between"}}>
        <Text style={{color:C.text, fontSize:15, fontWeight:"800"}}>{value||"1"}x</Text>
        <Text style={{color:C.text4, fontSize:9}}>▼</Text>
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="fade" onRequestClose={()=>setOpen(false)}>
        <TouchableOpacity style={{flex:1,backgroundColor:"rgba(0,0,0,0.5)",justifyContent:"center",alignItems:"center"}}
          activeOpacity={1} onPress={()=>setOpen(false)}>
          <View style={{backgroundColor:C.bg3,borderRadius:18,borderWidth:1.5,
            borderColor:C.border,width:160,overflow:"hidden"}}>
            <Text style={{color:C.text,fontSize:13,fontWeight:"700",padding:12,
              textAlign:"center",borderBottomWidth:1,borderBottomColor:C.border}}>
              Menge wählen
            </Text>
            <ScrollView showsVerticalScrollIndicator={false} style={{maxHeight:340}}>
              {nums.map(n=>(
                <TouchableOpacity key={n} onPress={()=>{onChange(n);setOpen(false);}}
                  style={{paddingVertical:13,paddingHorizontal:20,
                    backgroundColor:value===n||(!value&&n==="1")?C.accent:C.bg3,
                    borderBottomWidth:1,borderBottomColor:C.border,
                    flexDirection:"row",alignItems:"center",justifyContent:"space-between"}}>
                  <Text style={{color:value===n||(!value&&n==="1")?"#fff":C.text,
                    fontSize:20,fontWeight:"800"}}>{n}x</Text>
                  {(value===n||(!value&&n==="1"))&&
                    <Text style={{color:"#fff",fontSize:14}}>✓</Text>}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

function ShoppingTab({C}){const[lists,setLists]=useState([]);const[master,setMaster]=useState(DEFAULT_MASTER);const[listMasters,setListMasters]=useState({});const[openId,setOpenId]=useState(null);const[showNew,setShowNew]=useState(false);const[newName,setNewName]=useState("");const[newItem,setNewItem]=useState("");const[newQty,setNewQty]=useState("1");const[showMaster,setShowMaster]=useState(false);const[masterSearch,setMasterSearch]=useState("");const[newMasterItem,setNewMasterItem]=useState("");const[editItem,setEditItem]=useState(null);const[editVal,setEditVal]=useState("");const[editQty,setEditQty]=useState("");useEffect(()=>{loadData(KEYS.sh).then(d=>{if(d)setLists(d);});loadData(KEYS.master).then(d=>{if(d)setMaster(d);});loadData("lo_list_masters").then(d=>{if(d)setListMasters(d);});},[]);useEffect(()=>{const sub=BackHandler.addEventListener("hardwareBackPress",()=>{if(openId){setOpenId(null);return true;}return false;});return()=>sub.remove();},[openId]);const persistL=useCallback(l=>{setLists(l);saveData(KEYS.sh,l);},[]);const persistM=useCallback(m=>{setMaster(m);saveData(KEYS.master,m);},[]);const getListMaster=(lid)=>listMasters[lid]||master;const persistListMaster=useCallback((lid,m)=>{  const next={...listMasters,[lid]:m};  setListMasters(next);saveData("lo_list_masters",next);},[listMasters]);const createList=()=>{if(!newName.trim())return;persistL([...lists,{id:uid(),name:newName.trim(),items:[]}]);setNewName("");setShowNew(false);};const deleteList=id=>Alert.alert("Liste löschen?","Dauerhaft löschen?",[{text:"Abbrechen",style:"cancel"},{text:"Löschen",style:"destructive",onPress:()=>{persistL(lists.filter(l=>l.id!==id));if(openId===id)setOpenId(null);}}]);const clearAll=()=>Alert.alert("Liste leeren?","Alle Produkte löschen?",[{text:"Abbrechen",style:"cancel"},{text:"Alle löschen",style:"destructive",onPress:()=>persistL(lists.map(l=>l.id===openId?{...l,items:[]}:l))}]);const addItem=(text,qty)=>{const t=(text||newItem).trim();if(!t||!openId)return;persistL(lists.map(l=>l.id===openId?{...l,items:[...l.items,{id:uid(),text:t,qty:(qty!==undefined?qty:newQty)||"1",done:false}]}:l));if(!text){setNewItem("");setNewQty("1");}};const toggleItem=id=>persistL(lists.map(l=>l.id===openId?{...l,items:l.items.map(i=>i.id===id?{...i,done:!i.done}:i)}:l));const deleteItem=id=>persistL(lists.map(l=>l.id===openId?{...l,items:l.items.filter(i=>i.id!==id)}:l));const saveEdit=()=>{if(!editVal.trim())return;persistL(lists.map(l=>l.id===openId?{...l,items:l.items.map(i=>i.id===editItem.id?{...i,text:editVal.trim(),qty:editQty.trim()}:i)}:l));setEditItem(null);};const current=lists.find(l=>l.id===openId);const shDrag=useDrag(current?current.items:[],itms=>persistL(lists.map(l=>l.id===openId?{...l,items:itms}:l)));if(openId&&current){const done=current.items.filter(i=>i.done).length;const curMaster=getListMaster(current.id);const filtered=curMaster.filter(m=>m.toLowerCase().includes(masterSearch.toLowerCase())&&!current.items.some(i=>i.text===m));return(<View style={{flex:1}}><View style={{flexDirection:"row",alignItems:"center",gap:10,marginBottom:18}}><TouchableOpacity onPress={()=>setOpenId(null)} style={{backgroundColor:C.bg4,padding:8,borderRadius:10}}><Text style={{color:C.text3,fontSize:20}}>‹</Text></TouchableOpacity><Text style={{color:C.text,fontSize:20,fontWeight:"800",flex:1}}>{current.name}</Text><Btn C={C} variant="ghost" small label="⭐ Vorschläge" onPress={()=>setShowMaster(true)}/></View><View style={{flexDirection:"row",gap:8,marginBottom:14}}><QtyPicker C={C} value={newQty} onChange={setNewQty}/><Inp C={C} value={newItem} onChangeText={setNewItem} placeholder="Produkt hinzufügen…" onSubmitEditing={()=>addItem()}/><Btn C={C} label="+" onPress={()=>addItem()} style={{paddingHorizontal:18,flex:0}}/></View>{current.items.length>0&&<View style={{flexDirection:"row",justifyContent:"space-between",alignItems:"center",marginBottom:10}}><Text style={{color:C.text4,fontSize:12,fontWeight:"600"}}>{done}/{current.items.length} eingepackt</Text><TouchableOpacity onPress={clearAll} style={{backgroundColor:C.red+"22",paddingVertical:5,paddingHorizontal:10,borderRadius:8,borderWidth:1,borderColor:C.red+"44"}}><Text style={{color:C.red,fontSize:11,fontWeight:"700"}}>🗑 Alle löschen</Text></TouchableOpacity></View>}<ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">{current.items.length===0&&<EmptyState C={C} emoji="🛒" text="Noch nichts auf der Liste"/>}{(shDrag.isDragActive?shDrag.displayItems:current.items).map(item=>(<View key={item.id} style={{flexDirection:"row",alignItems:"center",gap:8,paddingVertical:7,paddingHorizontal:10,backgroundColor:shDrag.isDragging(item.id)?C.accent+"22":item.done?C.bg4:C.card,borderRadius:12,marginBottom:5,borderWidth:1.5,borderColor:shDrag.isDragging(item.id)?C.accent:item.done?C.border2:C.border,elevation:shDrag.isDragging(item.id)?4:item.done?0:1}}><View {...shDrag.makeHandlers(item.id)} style={{paddingHorizontal:4,paddingVertical:8}}><Text style={{color:C.text4,fontSize:16,opacity:0.6}}>☰</Text></View><TouchableOpacity onPress={()=>toggleItem(item.id)} style={{flex:1,flexDirection:"row",alignItems:"center",gap:8}}><View style={{width:24,height:24,borderRadius:12,borderWidth:2,borderColor:item.done?C.accent:C.border,backgroundColor:item.done?C.accent:"transparent",alignItems:"center",justifyContent:"center"}}>{item.done&&<Text style={{color:"#fff",fontSize:13,fontWeight:"700"}}>✓</Text>}</View>{item.qty?(<View style={{backgroundColor:C.orange+"33",paddingHorizontal:8,paddingVertical:2,borderRadius:8}}><Text style={{color:C.orange,fontSize:11,fontWeight:"700"}}>{item.qty}x</Text></View>):null}<View style={{flex:1}}><Text style={{color:item.done?C.text4:C.text,fontSize:14,fontWeight:item.done?"400":"500",textDecorationLine:item.done?"line-through":"none",textDecorationColor:item.done?C.text:"transparent",textDecorationStyle:"solid"}}>{item.text}</Text>{item.done&&<View style={{position:"absolute",left:0,right:0,top:8,height:3,backgroundColor:C.text2,borderRadius:1,opacity:0.9}}/>}</View></TouchableOpacity><TouchableOpacity onPress={()=>{setEditItem(item);setEditVal(item.text);setEditQty(item.qty||"");}} style={{padding:3,opacity:0.6}}><Text style={{fontSize:16}}>✏️</Text></TouchableOpacity><TouchableOpacity onPress={()=>deleteItem(item.id)} style={{padding:3,opacity:0.6}}><Text style={{fontSize:16}}>🗑</Text></TouchableOpacity></View>))}</ScrollView>

        <FullModal C={C} visible={showMaster} title={"⭐ Vorschläge: "+current.name} onClose={()=>{setShowMaster(false);setMasterSearch("");}}>
          <View style={{flexDirection:"row",gap:8,marginBottom:10}}>
            <Inp C={C} value={newMasterItem} onChangeText={setNewMasterItem} placeholder="Neues Produkt…" onSubmitEditing={()=>{if(newMasterItem.trim()){persistListMaster(current.id,[...curMaster,newMasterItem.trim()]);setNewMasterItem("");}}}/>
            <Btn C={C} small label="+" onPress={()=>{if(newMasterItem.trim()){persistListMaster(current.id,[...curMaster,newMasterItem.trim()]);setNewMasterItem("");}}} style={{flex:0}}/>
          </View>
          <Inp C={C} value={masterSearch} onChangeText={setMasterSearch} placeholder="Suchen…" style={{flex:0,marginBottom:10}}/>
          <ScrollView nestedScrollEnabled={true} showsVerticalScrollIndicator={true} keyboardShouldPersistTaps="handled">
            {filtered.length===0&&<Text style={{color:C.text4,fontSize:13,marginBottom:8}}>Alle bereits auf der Liste</Text>}
            {filtered.map((item,i)=>(
              <View key={i} style={{flexDirection:"row",justifyContent:"space-between",alignItems:"center",padding:11,backgroundColor:C.bg4,borderRadius:10,marginBottom:7,borderWidth:1,borderColor:C.border}}>
                <Text style={{color:C.text,fontSize:14,fontWeight:"500",flex:1}}>{item}</Text>
                <View style={{flexDirection:"row",gap:8}}>
                  <Btn C={C} small label="+ Hinzufügen" onPress={()=>addItem(item,"")}/>
                  <TouchableOpacity onPress={()=>persistListMaster(current.id,curMaster.filter(m=>m!==item))} style={{padding:4,opacity:0.6}}><Text style={{fontSize:15}}>🗑</Text></TouchableOpacity>
                </View>
              </View>
            ))}
          </ScrollView>
        </FullModal>

        <AppModal C={C} visible={!!editItem} title="Produkt bearbeiten" onClose={()=>setEditItem(null)}><FLabel C={C} text="Menge"/><QtyPicker C={C} value={editQty} onChange={setEditQty}/><View style={{height:12}}/><FLabel C={C} text="Produkt"/><Inp C={C} value={editVal} onChangeText={setEditVal} onSubmitEditing={saveEdit} style={{flex:0}}/><View style={{flexDirection:"row",gap:8,marginTop:14}}><Btn C={C} label="Speichern" onPress={saveEdit}/><Btn C={C} variant="ghost" label="Abbrechen" onPress={()=>setEditItem(null)}/></View></AppModal></View>);}

  return(<View style={{flex:1}}><SectionHeader C={C} title="Einkaufslisten" addLabel="+ Neue Liste" onAdd={()=>{setNewName("");setShowNew(true);}}/><ScrollView showsVerticalScrollIndicator={false}>{lists.length===0&&<EmptyState C={C} emoji="🛒" text="Noch keine Einkaufslisten"/>}<View style={{flexDirection:"row",flexWrap:"wrap",marginHorizontal:-5}}>{lists.map(list=>{const done=list.items.filter(i=>i.done).length;return<Card key={list.id} C={C} title={list.name} sub={`${list.items.length} Produkte · ${done} erledigt`} accentColor={C.orange} onPress={()=>setOpenId(list.id)} onDelete={()=>deleteList(list.id)}/>;})}</View></ScrollView><FullModal C={C} visible={showNew} title="Neue Einkaufsliste" onClose={()=>{setShowNew(false);setNewName("");}}><FLabel C={C} text="Listenname"/><Inp C={C} value={newName} onChangeText={setNewName} placeholder="z.B. Campingwochenende…" onSubmitEditing={createList} style={{flex:0}}/><View style={{flexDirection:"row",gap:8,marginTop:14}}><Btn C={C} label="Erstellen" onPress={createList}/><Btn C={C} variant="ghost" label="Abbrechen" onPress={()=>{setShowNew(false);setNewName("");}}/>    </View></FullModal></View>);}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: TODO
// ═══════════════════════════════════════════════════════════════════════════════
function ToDoTab({C}){
  const[lists,setLists]=useState([]);
  const[openId,setOpenId]=useState(null);
  const[showNew,setShowNew]=useState(false);
  const[newName,setNewName]=useState("");
  const[renameId,setRenameId]=useState(null);
  const[newItem,setNewItem]=useState("");
  const[newNote,setNewNote]=useState("");
  const[editItem,setEditItem]=useState(null);
  const[editVal,setEditVal]=useState("");
  const[editNote,setEditNote]=useState("");

  useEffect(()=>{loadData("lo_todo").then(d=>{if(d)setLists(d);});},[]);
  useEffect(()=>{
    const sub=BackHandler.addEventListener("hardwareBackPress",()=>{if(openId){setOpenId(null);return true;}return false;});
    return()=>sub.remove();
  },[openId]);
  const persist=useCallback(l=>{setLists(l);saveData("lo_todo",l);},[]);

  const createList=()=>{
    if(!newName.trim())return;
    if(renameId){persist(lists.map(l=>l.id===renameId?{...l,name:newName.trim()}:l));setRenameId(null);}
    else{persist([...lists,{id:uid(),name:newName.trim(),items:[]}]);}
    setNewName("");setShowNew(false);
  };
  const deleteList=id=>Alert.alert("Liste löschen?","Dauerhaft löschen?",[
    {text:"Abbrechen",style:"cancel"},
    {text:"Löschen",style:"destructive",onPress:()=>{persist(lists.filter(l=>l.id!==id));if(openId===id)setOpenId(null);}},
  ]);
  const addItem=()=>{
    if(!newItem.trim()||!openId)return;
    persist(lists.map(l=>l.id===openId?{...l,items:[...l.items,{id:uid(),text:newItem.trim(),note:newNote.trim(),done:false,priority:false}]}:l));
    setNewItem("");setNewNote("");
  };
  const toggleItem=id=>persist(lists.map(l=>l.id===openId?{...l,items:l.items.map(i=>i.id===id?{...i,done:!i.done}:i)}:l));
  const togglePriority=id=>persist(lists.map(l=>l.id===openId?{...l,items:l.items.map(i=>i.id===id?{...i,priority:!i.priority}:i)}:l));
  const deleteItem=id=>persist(lists.map(l=>l.id===openId?{...l,items:l.items.filter(i=>i.id!==id)}:l));
  const saveEdit=()=>{
    if(!editVal.trim())return;
    persist(lists.map(l=>l.id===openId?{...l,items:l.items.map(i=>i.id===editItem.id?{...i,text:editVal.trim(),note:editNote.trim()}:i)}:l));
    setEditItem(null);setEditVal("");setEditNote("");
  };
  const resetAll=()=>persist(lists.map(l=>l.id===openId?{...l,items:l.items.map(i=>({...i,done:false}))}:l));
  const current=lists.find(l=>l.id===openId);
  const tdDrag=useDrag(current?[...current.items].sort((a,b)=>{if(a.done!==b.done)return a.done?1:-1;if(a.priority!==b.priority)return a.priority?-1:1;return 0;}):[], items=>persist(lists.map(l=>l.id===openId?{...l,items}:l)));

  if(openId&&current){
    const done=current.items.filter(i=>i.done).length,total=current.items.length;
    return(
      <View style={{flex:1}}>
        <View style={{flexDirection:"row",alignItems:"center",gap:10,marginBottom:14}}>
          <TouchableOpacity onPress={()=>setOpenId(null)} style={{backgroundColor:C.bg4,padding:8,borderRadius:10}}>
            <Text style={{color:C.text3,fontSize:20}}>‹</Text>
          </TouchableOpacity>
          <Text style={{color:C.text,fontSize:20,fontWeight:"800",flex:1}}>{current.name}</Text>
          <TouchableOpacity onPress={()=>{setNewName(current.name);setRenameId(current.id);setShowNew(true);}} style={{backgroundColor:C.bg4,padding:8,borderRadius:10}}>
            <Text style={{fontSize:16}}>✏️</Text>
          </TouchableOpacity>
        </View>

        {total>0&&(
          <View style={{backgroundColor:C.bg4,borderRadius:12,padding:8,marginBottom:10,flexDirection:"row",alignItems:"center",gap:10,borderWidth:1,borderColor:C.border}}>
            <Text style={{color:C.text3,fontSize:12,fontWeight:"700"}}>{done}/{total} erledigt</Text>
            <View style={{flex:1,backgroundColor:C.border,borderRadius:3,height:5,overflow:"hidden"}}>
              <View style={{height:"100%",width:`${total>0?Math.round(done/total*100):0}%`,backgroundColor:C.accent}}/>
            </View>
            {done>0&&<Btn C={C} variant="ghost" small label="Reset" onPress={resetAll}/>}
          </View>
        )}

        <View style={{marginBottom:10}}>
          <View style={{flexDirection:"row",gap:8,marginBottom:5}}>
            <Inp C={C} value={newItem} onChangeText={setNewItem} placeholder="Neue Aufgabe…" onSubmitEditing={addItem}/>
            <Btn C={C} label="+" onPress={addItem} style={{paddingHorizontal:18,flex:0}}/>
          </View>
          <Inp C={C} value={newNote} onChangeText={setNewNote} placeholder="Notiz (optional)…" style={{fontSize:13}}/>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {current.items.length===0&&<EmptyState C={C} emoji="✅" text="Keine Aufgaben" sub="Füge deine erste Aufgabe hinzu"/>}
          {(tdDrag.isDragActive?tdDrag.displayItems:current.items).map(item=>(
            <View key={item.id} style={{flexDirection:"row",alignItems:"center",gap:7,paddingVertical:7,paddingHorizontal:10,
              backgroundColor:tdDrag.isDragging(item.id)?C.accent+"22":item.done?C.bg4:C.card,borderRadius:12,marginBottom:5,
              borderWidth:1.5,borderColor:tdDrag.isDragging(item.id)?C.accent:item.done?C.border2:item.priority?C.orange:C.border,
              borderLeftWidth:3,borderLeftColor:tdDrag.isDragging(item.id)?C.accent:item.done?C.border2:item.priority?C.orange:C.accent,
              elevation:tdDrag.isDragging(item.id)?4:item.done?0:1}}>
              <View {...tdDrag.makeHandlers(item.id)} style={{paddingHorizontal:4,paddingVertical:8}}>
                <Text style={{color:C.text4,fontSize:16,opacity:0.6}}>☰</Text>
              </View>
              {/* Checkbox */}
              <TouchableOpacity onPress={()=>toggleItem(item.id)}
                style={{width:22,height:22,borderRadius:6,borderWidth:2,
                  borderColor:item.done?C.accent:C.border,
                  backgroundColor:item.done?C.accent:"transparent",
                  alignItems:"center",justifyContent:"center",flexShrink:0}}>
                {item.done&&<Text style={{color:"#fff",fontSize:12,fontWeight:"700"}}>✓</Text>}
              </TouchableOpacity>
              {/* Text */}
              <View style={{flex:1}}>
                <Text style={{color:item.done?C.text4:C.text,fontSize:14,fontWeight:"500",
                  textDecorationLine:item.done?"line-through":"none"}}>{item.text}</Text>
                {item.note?<Text style={{color:C.text4,fontSize:11,marginTop:1}}>{item.note}</Text>:null}
              </View>
              {/* Priority star */}
              <TouchableOpacity onPress={()=>togglePriority(item.id)} style={{padding:3}}>
                <Text style={{fontSize:16,opacity:item.priority?1:0.3}}>⭐</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={()=>{setEditItem(item);setEditVal(item.text);setEditNote(item.note||"");}} style={{padding:3,opacity:0.6}}>
                <Text style={{fontSize:15}}>✏️</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={()=>deleteItem(item.id)} style={{padding:3,opacity:0.6}}>
                <Text style={{fontSize:15}}>🗑</Text>
              </TouchableOpacity>
            </View>
          ))}
        </ScrollView>

        <AppModal C={C} visible={!!editItem} title="Aufgabe bearbeiten" onClose={()=>setEditItem(null)}>
          <FLabel C={C} text="Aufgabe"/>
          <Inp C={C} value={editVal} onChangeText={setEditVal} onSubmitEditing={saveEdit} style={{flex:0,marginBottom:12}}/>
          <FLabel C={C} text="Notiz"/>
          <Inp C={C} value={editNote} onChangeText={setEditNote} placeholder="Optional…" style={{flex:0}}/>
          <View style={{flexDirection:"row",gap:8,marginTop:14}}>
            <Btn C={C} label="Speichern" onPress={saveEdit}/>
            <Btn C={C} variant="ghost" label="Abbrechen" onPress={()=>setEditItem(null)}/>
          </View>
        </AppModal>
        <FullModal C={C} visible={showNew} title={renameId?"Umbenennen":"Neue To-Do-Liste"} onClose={()=>{setShowNew(false);setNewName("");setRenameId(null);}}>
          <FLabel C={C} text="Listenname"/>
          <Inp C={C} value={newName} onChangeText={setNewName} placeholder="z.B. Urlaub planen, Reparaturen…" onSubmitEditing={createList} style={{flex:0}}/>
          <View style={{flexDirection:"row",gap:8,marginTop:14}}>
            <Btn C={C} label={renameId?"Speichern":"Erstellen"} onPress={createList}/>
            <Btn C={C} variant="ghost" label="Abbrechen" onPress={()=>{setShowNew(false);setNewName("");setRenameId(null);}}/>
          </View>
        </FullModal>
      </View>
    );
  }

  return(
    <View style={{flex:1}}>
      <SectionHeader C={C} title="To-Do Listen" addLabel="+ Neue Liste" onAdd={()=>{setRenameId(null);setNewName("");setShowNew(true);}}/>
      <ScrollView showsVerticalScrollIndicator={false}>
        {lists.length===0&&<EmptyState C={C} emoji="✅" text="Noch keine To-Do Listen" sub='z.B. „Urlaub planen"'/>}
        <View style={{flexDirection:"row",flexWrap:"wrap",marginHorizontal:-5}}>
          {lists.map(list=>{
            const done=list.items.filter(i=>i.done).length,total=list.items.length;
            const prio=list.items.filter(i=>i.priority&&!i.done).length;
            return(
              <Card key={list.id} C={C}
                title={list.name}
                sub={`${total} Aufgaben · ${done} erledigt${prio>0?" · ⭐ "+prio:""}`}
                progress={total?Math.round(done/total*100):null}
                accentColor="#9b6fc4"
                onPress={()=>setOpenId(list.id)}
                onDelete={()=>deleteList(list.id)}/>
            );
          })}
        </View>
      </ScrollView>
      <FullModal C={C} visible={showNew} title="Neue To-Do-Liste" onClose={()=>{setShowNew(false);setNewName("");}}>
        <FLabel C={C} text="Listenname"/>
        <Inp C={C} value={newName} onChangeText={setNewName} placeholder="z.B. Urlaub planen, Reparaturen…" onSubmitEditing={createList} style={{flex:0}}/>
        <View style={{flexDirection:"row",gap:8,marginTop:14}}>
          <Btn C={C} label="Erstellen" onPress={createList}/>
          <Btn C={C} variant="ghost" label="Abbrechen" onPress={()=>{setShowNew(false);setNewName("");}}/>        </View>
      </FullModal>
    </View>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB: EINSTELLUNGEN & BACKUP
// ═══════════════════════════════════════════════════════════════════════════════
function SettingsTab({C}) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);

  const importData = async () => {
    setStatus(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/json",
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const uri = result.assets[0].uri;
      const json = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.UTF8 });
      const data = JSON.parse(json);
      setLoading(true);
      let count = 0;
      for (const [k, v] of Object.entries(data)) {
        if (k !== "_backup_date" && v !== null) {
          await saveData(k, v);
          count++;
        }
      }
      setStatus({ok:true, msg:"✅ " + count + " Datensätze wiederhergestellt! Bitte App neu starten."});
    } catch(e) {
      setStatus({ok:false, msg:"❌ Fehler beim Einlesen: " + e.message});
    }
    setLoading(false);
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <Text style={{color:C.text, fontSize:20, fontWeight:"800", marginBottom:20}}>Einstellungen</Text>

      {status && (
        <View style={{backgroundColor:status.ok?C.accent+"22":C.red+"22",
          borderRadius:12, padding:14, marginBottom:16,
          borderWidth:1.5, borderColor:status.ok?C.accent:C.red}}>
          <Text style={{color:status.ok?C.accent:C.red, fontSize:13, fontWeight:"600"}}>{status.msg}</Text>
        </View>
      )}

      {/* EXPORT */}
      <View style={{backgroundColor:C.card, borderRadius:16, padding:16, marginBottom:14,
        borderWidth:1.5, borderColor:C.border}}>
        <Text style={{color:C.text, fontSize:16, fontWeight:"800", marginBottom:4}}>📤 Backup erstellen</Text>
        <Text style={{color:C.text4, fontSize:12, marginBottom:12}}>
          Erstellt eine JSON-Datei mit allen deinen Daten. Du kannst sie in Downloads speichern, per E-Mail senden oder auf Google Drive ablegen.
        </Text>
        <Btn C={C} label={loading?"Lädt…":"Backup als Datei speichern"} onPress={exportData} disabled={loading}
          style={{alignSelf:"flex-start"}}/>
      </View>

      {/* IMPORT */}
      <View style={{backgroundColor:C.card, borderRadius:16, padding:16, marginBottom:14,
        borderWidth:1.5, borderColor:C.border}}>
        <Text style={{color:C.text, fontSize:16, fontWeight:"800", marginBottom:4}}>📥 Backup wiederherstellen</Text>
        <Text style={{color:C.text4, fontSize:12, marginBottom:12}}>
          Wähle eine zuvor gespeicherte Backup-Datei aus. Bestehende Daten werden überschrieben!
        </Text>
        <Btn C={C} variant="ghost" label={loading?"Lädt…":"Backup-Datei auswählen…"} onPress={importData} disabled={loading}
          style={{alignSelf:"flex-start"}}/>
      </View>

      {/* INFO */}
      <View style={{backgroundColor:C.card, borderRadius:16, padding:16,
        borderWidth:1.5, borderColor:C.border, marginBottom:8}}>
        <Text style={{color:C.text, fontSize:16, fontWeight:"800", marginBottom:10}}>ℹ️ App Info</Text>
        {[["App","Lotte's Organizer"],["Version","1.0.0"],["Speicher","Lokal auf dem Gerät"]].map(([k,v])=>(
          <View key={k} style={{flexDirection:"row",justifyContent:"space-between",marginBottom:4}}>
            <Text style={{color:C.text4,fontSize:12}}>{k}</Text>
            <Text style={{color:C.text3,fontSize:12,fontWeight:"600"}}>{v}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

  const exportData = async () => {
    setLoading(true);
    setStatus(null);
    try {
      const allKeys = [...Object.values(KEYS), "lo_todo", "lo_list_masters"];
      const result = {};
      for (const k of allKeys) {
        const v = await loadData(k);
        if (v !== null) result[k] = v;
      }
      result["_backup_date"] = new Date().toLocaleDateString("de-DE", {
        day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit"
      });
      const json = JSON.stringify(result, null, 2);
      const date = new Date().toISOString().slice(0,10);
      const fileName = "lottes_backup_" + date + ".json";
      // 1. In Cache schreiben
      const cachePath = FileSystem.cacheDirectory + fileName;
      await FileSystem.writeAsStringAsync(cachePath, json, {encoding: FileSystem.EncodingType.UTF8});
      // 2. Ordner-Picker öffnen (genau wie beim Import der Datei-Browser öffnet)
      const perm = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
      if (!perm.granted) { setStatus({ok:false, msg:"❌ Kein Ordner gewählt."}); setLoading(false); return; }
      // 3. Datei im gewählten Ordner erstellen
      const destUri = await FileSystem.StorageAccessFramework.createFileAsync(perm.directoryUri, fileName, "application/json");
      const fileContent = await FileSystem.readAsStringAsync(cachePath);
      await FileSystem.writeAsStringAsync(destUri, fileContent, {encoding: FileSystem.EncodingType.UTF8});
      setStatus({ok:true, msg:"✅ Backup gespeichert: " + fileName});
    } catch(e) {
      setStatus({ok:false, msg:"❌ Fehler: " + (e.message || String(e))});
    }
    setLoading(false);
  };

  const importData = async () => {
    setStatus(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/json",
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const uri = result.assets[0].uri;
      const json = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.UTF8 });
      const data = JSON.parse(json);
      setLoading(true);
      let count = 0;
      for (const [k, v] of Object.entries(data)) {
        if (k !== "_backup_date" && v !== null) {
          await saveData(k, v);
          count++;
        }
      }
      setStatus({ok:true, msg:"✅ " + count + " Datensätze wiederhergestellt! Bitte App neu starten."});
    } catch(e) {
      setStatus({ok:false, msg:"❌ Fehler beim Einlesen: " + e.message});
    }
    setLoading(false);
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <Text style={{color:C.text, fontSize:20, fontWeight:"800", marginBottom:20}}>Einstellungen</Text>

      {status && (
        <View style={{backgroundColor:status.ok?C.accent+"22":C.red+"22",
          borderRadius:12, padding:14, marginBottom:16,
          borderWidth:1.5, borderColor:status.ok?C.accent:C.red}}>
          <Text style={{color:status.ok?C.accent:C.red, fontSize:13, fontWeight:"600"}}>{status.msg}</Text>
        </View>
      )}

      {/* EXPORT */}
      <View style={{backgroundColor:C.card, borderRadius:16, padding:16, marginBottom:14,
        borderWidth:1.5, borderColor:C.border}}>
        <Text style={{color:C.text, fontSize:16, fontWeight:"800", marginBottom:4}}>📤 Backup erstellen</Text>
        <Text style={{color:C.text4, fontSize:12, marginBottom:12}}>
          Erstellt eine JSON-Datei mit allen deinen Daten. Du kannst sie in Downloads speichern, per E-Mail senden oder auf Google Drive ablegen.
        </Text>
        <Btn C={C} label={loading?"Lädt…":"Backup als Datei speichern"} onPress={exportData} disabled={loading}
          style={{alignSelf:"flex-start"}}/>
      </View>

      {/* IMPORT */}
      <View style={{backgroundColor:C.card, borderRadius:16, padding:16, marginBottom:14,
        borderWidth:1.5, borderColor:C.border}}>
        <Text style={{color:C.text, fontSize:16, fontWeight:"800", marginBottom:4}}>📥 Backup wiederherstellen</Text>
        <Text style={{color:C.text4, fontSize:12, marginBottom:12}}>
          Wähle eine zuvor gespeicherte Backup-Datei aus. Bestehende Daten werden überschrieben!
        </Text>
        <Btn C={C} variant="ghost" label={loading?"Lädt…":"Backup-Datei auswählen…"} onPress={importData} disabled={loading}
          style={{alignSelf:"flex-start"}}/>
      </View>

      {/* INFO */}
      <View style={{backgroundColor:C.card, borderRadius:16, padding:16,
        borderWidth:1.5, borderColor:C.border, marginBottom:8}}>
        <Text style={{color:C.text, fontSize:16, fontWeight:"800", marginBottom:10}}>ℹ️ App Info</Text>
        {[["App","Lotte's Organizer"],["Version","1.0.0"],["Speicher","Lokal auf dem Gerät"]].map(([k,v])=>(
          <View key={k} style={{flexDirection:"row",justifyContent:"space-between",marginBottom:4}}>
            <Text style={{color:C.text4,fontSize:12}}>{k}</Text>
            <Text style={{color:C.text3,fontSize:12,fontWeight:"600"}}>{v}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

  const exportData = async () => {
    setLoading(true);
    setStatus(null);
    try {
      // Daten sammeln
      const allKeys = [...Object.values(KEYS), "lo_todo", "lo_list_masters"];
      const result = {};
      for (const k of allKeys) {
        const v = await loadData(k);
        if (v !== null) result[k] = v;
      }
      result["_backup_date"] = new Date().toLocaleDateString("de-DE", {
        day:"2-digit", month:"2-digit", year:"numeric", hour:"2-digit", minute:"2-digit"
      });
  const importData = async () => {
    setStatus(null);
    try {
      const res = await DocumentPicker.getDocumentAsync({ type:"application/json", copyToCacheDirectory:true });
      if (res.canceled) return;
      setLoading(true);
      const json = await FileSystem.readAsStringAsync(res.assets[0].uri);
      const data = JSON.parse(json);
      let count = 0;
      for (const [k, v] of Object.entries(data)) {
        if (k !== "_backup_date" && v !== null) { await saveData(k, v); count++; }
      }
      setStatus({ok:true, msg:"✅ "+count+" Datensätze wiederhergestellt! Bitte App neu starten."});
    } catch(e) {
      setStatus({ok:false, msg:"❌ Fehler: "+e.message});
    }
    setLoading(false);
  };


export default function App(){const[isDark,setIsDark]=useState(true);const[themeLoaded,setThemeLoaded]=useState(false);const[tab,setTab]=useState(0);const C=isDark?DARK:LIGHT;useEffect(()=>{loadData(KEYS.theme).then(d=>{if(d!==null)setIsDark(d);setThemeLoaded(true);});},[]);const toggleTheme=()=>{const next=!isDark;setIsDark(next);saveData(KEYS.theme,next);};if(!themeLoaded)return null;const tabs=[{label:"Kalender",emoji:"📅",comp:<RemindersTab C={C}/>},{label:"Checklisten",emoji:"📋",comp:<ChecklistTab C={C}/>},{label:"To-Do",emoji:"✅",comp:<ToDoTab C={C}/>},{label:"Einkauf",emoji:"🛒",comp:<ShoppingTab C={C}/>},{label:"Einstellg.",emoji:"⚙️",comp:<SettingsTab C={C}/>}];return(<SafeAreaView style={{flex:1,backgroundColor:C.bg}}><StatusBar barStyle={C.statusBar} backgroundColor={C.bg}/><View style={{paddingHorizontal:16,paddingTop:Platform.OS==="android"?22:8,paddingBottom:10,flexDirection:"row",alignItems:"center",gap:10,borderBottomWidth:1,borderBottomColor:C.border,backgroundColor:C.bg}}><Text style={{fontSize:28}}>🚐</Text><View style={{flex:1}}><Text style={{color:C.text,fontSize:20,fontWeight:"800",letterSpacing:0.2}}>Lotte's Organizer</Text><Text style={{color:C.text4,fontSize:11,fontWeight:"600"}}>Dein Camping-Begleiter</Text></View><View style={{flexDirection:"row",alignItems:"center",gap:6}}><Text style={{fontSize:16}}>{isDark?"🌙":"☀️"}</Text><Switch value={isDark} onValueChange={toggleTheme} trackColor={{false:"#e8d5c8",true:"#2d5a2d"}} thumbColor={isDark?DARK.accent:LIGHT.accent}/></View></View><View style={{flex:1,padding:16}}>{tabs[tab].comp}</View><View style={{flexDirection:"row",borderTopWidth:1,borderTopColor:C.border,backgroundColor:C.bg3,shadowColor:"#000",shadowOpacity:0.06,shadowRadius:8,shadowOffset:{width:0,height:-2},elevation:8}}>{tabs.map((t,i)=>(<TouchableOpacity key={i} onPress={()=>setTab(i)} activeOpacity={0.7} style={{flex:1,paddingTop:6,paddingBottom:4,alignItems:"center",gap:2}}><View style={{padding:5,borderRadius:10,backgroundColor:tab===i?C.accent+"22":"transparent"}}><Text style={{fontSize:20}}>{t.emoji}</Text></View><Text style={{fontSize:9,fontWeight:"700",color:tab===i?C.accent:C.text4}}>{t.label}</Text></TouchableOpacity>))}</View><View style={{height:NAV_BAR_H,backgroundColor:C.bg3}}/></SafeAreaView>);}
