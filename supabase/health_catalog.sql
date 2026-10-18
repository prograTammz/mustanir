alter table public.health_metrics drop constraint if exists health_metrics_agg_check;
alter table public.health_metrics add constraint health_metrics_agg_check check (agg in ('sum','avg','last','minutes','min','max'));
alter table public.health_metrics add column if not exists aliases text[] not null default '{}', add column if not exists better smallint not null default 0, add column if not exists sort int;
insert into public.health_metrics(key,label,unit,agg,category,better,aliases,sort) values
('activeKcal','Active Energy','kcal','sum','activity',1,array['activeenergy','activeenergykj','activekcal']::text[],0),
('alcohol_consumption','Alcohol Consumption','','sum','nutrition',0,array['alcoholconsumption','alcoholconsumptioncount']::text[],1),
('exerciseMin','Exercise Time','min','sum','activity',1,array['appleexercisetime','appleexercisetimemin','exercisemin']::text[],2),
('apple_move_time','Move Time','min','sum','activity',0,array['applemovetime','applemovetimemin']::text[],3),
('wristTemp','Sleeping Wrist Temperature','°C','avg','vitals',0,array['applesleepingwristtemperature','applesleepingwristtemperaturedegc','wristtemp']::text[],4),
('standHours','Stand Hour','','sum','activity',1,array['applestandhour','applestandhourcount','standhours']::text[],5),
('standMin','Stand Time','min','sum','activity',1,array['applestandtime','applestandtimemin','standmin']::text[],6),
('atrial_fibrillation_burden','Atrial Fibrillation Burden','%','avg','heart',0,array['atrialfibrillationburden']::text[],7),
('basal_body_temperature','Basal Body Temperature','°C','avg','vitals',0,array['basalbodytemperature','basalbodytemperaturedegc']::text[],8),
('biotin','Biotin','mcg','sum','nutrition',0,array['biotin','biotinmcg']::text[],9),
('blood_alcohol_content','Blood Alcohol Content','%','avg','vitals',0,array['bloodalcoholcontent']::text[],10),
('blood_glucose','Blood Glucose','mmol/L','avg','vitals',0,array['bloodglucose','bloodglucosemmoll']::text[],11),
('spo2','Blood Oxygen Saturation','%','avg','vitals',1,array['bloodoxygensaturation','spo2']::text[],12),
('blood_pressure_systolic','Blood Pressure · Systolic','mmHg','avg','heart',0,array['bloodpressuresystolic','bloodpressuresystolicmmhg']::text[],13),
('blood_pressure_diastolic','Blood Pressure · Diastolic','mmHg','avg','heart',0,array['bloodpressurediastolic','bloodpressurediastolicmmhg']::text[],14),
('bodyFat','Body Fat Percentage','%','last','body',-1,array['bodyfat','bodyfatpercentage']::text[],15),
('bmi','Body Mass Index','','last','body',-1,array['bmi','bodymassindex','bodymassindexcount']::text[],16),
('body_temperature','Body Temperature','°C','avg','body',0,array['bodytemperature','bodytemperaturedegc']::text[],17),
('breathing_disturbances','Breathing Disturbances','/hr','avg','sleep',-1,array['breathingdisturbances','breathingdisturbancescount']::text[],18),
('caffeine','Caffeine','mg','sum','nutrition',0,array['caffeine','caffeinemg']::text[],19),
('calcium','Calcium','mg','sum','nutrition',0,array['calcium','calciummg']::text[],20),
('carbs','Carbohydrates','g','sum','nutrition',0,array['carbohydrates','carbohydratesg','carbs']::text[],21),
('cardio_recovery','Cardio Recovery','bpm','avg','heart',1,array['cardiorecovery','cardiorecoverycountmin']::text[],22),
('chloride','Chloride','mg','sum','nutrition',0,array['chloride','chloridemg']::text[],23),
('cholesterol','Cholesterol','mg','sum','nutrition',0,array['cholesterol','cholesterolmg']::text[],24),
('chromium','Chromium','mcg','sum','nutrition',0,array['chromium','chromiummcg']::text[],25),
('copper','Copper','mg','sum','nutrition',0,array['copper','coppermg']::text[],26),
('cycling_cadence','Cycling Cadence','rpm','avg','sport',0,array['cyclingcadence','cyclingcadencecountmin']::text[],27),
('cycling_distance','Cycling Distance','km','sum','sport',0,array['cyclingdistance','cyclingdistancekm']::text[],28),
('cycling_functional_threshold_power','Cycling Functional Threshold Power','W','last','sport',0,array['cyclingfunctionalthresholdpower','cyclingfunctionalthresholdpowerw']::text[],29),
('cycling_power','Cycling Power','W','avg','sport',0,array['cyclingpower','cyclingpowerw']::text[],30),
('cycling_speed','Cycling Speed','km/hr','avg','sport',0,array['cyclingspeed','cyclingspeedkmhr']::text[],31),
('dietaryKcal','Dietary Energy','kcal','sum','nutrition',0,array['dietaryenergy','dietaryenergykj','dietarykcal']::text[],32),
('distance_downhill_snow_sports','Distance Downhill Snow Sports','km','sum','sport',0,array['distancedownhillsnowsports','distancedownhillsnowsportskm']::text[],33),
('electrodermal_activity','Electrodermal Activity','mcS','avg','vitals',0,array['electrodermalactivity','electrodermalactivitymcs']::text[],34),
('noiseDb','Environmental Audio Exposure','dB','avg','environment',-1,array['environmentalaudioexposure','environmentalaudioexposuredbaspl','noisedb']::text[],35),
('fiber','Fiber','g','sum','nutrition',0,array['fiber','fiberg']::text[],36),
('flights','Flights Climbed','','sum','activity',1,array['flights','flightsclimbed','flightsclimbedcount']::text[],37),
('folate','Folate','mcg','sum','nutrition',0,array['folate','folatemcg']::text[],38),
('forced_expiratory_volume_1','Forced Expiratory Volume 1','L','last','vitals',0,array['forcedexpiratoryvolume1','forcedexpiratoryvolume1l']::text[],39),
('forced_vital_capacity','Forced Vital Capacity','L','last','vitals',0,array['forcedvitalcapacity','forcedvitalcapacityl']::text[],40),
('handwashing','Handwashing','s','sum','mind',0,array['handwashing','handwashings']::text[],41),
('headphone_audio_exposure','Headphone Audio Exposure','dB','avg','environment',-1,array['headphoneaudioexposure','headphoneaudioexposuredbaspl']::text[],42),
('heart_rate_min','Heart Rate · Min','bpm','min','heart',0,array['heartratemin','heartratemincountmin']::text[],43),
('heart_rate_max','Heart Rate · Max','bpm','max','heart',0,array['heartratemax','heartratemaxcountmin']::text[],44),
('heartRate','Heart Rate','bpm','avg','heart',0,array['heartrate','heartrateavg','heartrateavgcountmin']::text[],45),
('hrv','Heart Rate Variability','ms','avg','heart',1,array['heartratevariability','heartratevariabilityms','hrv']::text[],46),
('height','Height','m','last','body',0,array['height','heightm']::text[],47),
('inhaler_usage','Inhaler Usage','','sum','vitals',0,array['inhalerusage','inhalerusagecount']::text[],48),
('insulin_delivery','Insulin Delivery','IU','sum','vitals',0,array['insulindelivery','insulindeliveryiu']::text[],49),
('iodine','Iodine','mcg','sum','nutrition',0,array['iodine','iodinemcg']::text[],50),
('iron','Iron','mg','sum','nutrition',0,array['iron','ironmg']::text[],51),
('leanMass','Lean Body Mass','kg','last','body',1,array['leanbodymass','leanbodymasskg','leanmass']::text[],52),
('magnesium','Magnesium','mg','sum','nutrition',0,array['magnesium','magnesiummg']::text[],53),
('manganese','Manganese','mg','sum','nutrition',0,array['manganese','manganesemg']::text[],54),
('mindfulMin','Mindful Minutes','min','minutes','mind',1,array['mindfulmin','mindfulminutes','mindfulminutesmin']::text[],55),
('molybdenum','Molybdenum','mcg','sum','nutrition',0,array['molybdenum','molybdenummcg']::text[],56),
('monounsaturated_fat','Monounsaturated Fat','g','sum','nutrition',0,array['monounsaturatedfat','monounsaturatedfatg']::text[],57),
('niacin','Niacin','mg','sum','nutrition',0,array['niacin','niacinmg']::text[],58),
('number_of_times_fallen','Number of Times Fallen','','sum','mobility',0,array['numberoftimesfallen','numberoftimesfallencount']::text[],59),
('pantothenic_acid','Pantothenic Acid','mg','sum','nutrition',0,array['pantothenicacid','pantothenicacidmg']::text[],60),
('peak_expiratory_flow_rate','Peak Expiratory Flow Rate','L/min','last','vitals',0,array['peakexpiratoryflowrate','peakexpiratoryflowratelmin']::text[],61),
('peripheral_perfusion_index','Peripheral Perfusion Index','%','avg','heart',0,array['peripheralperfusionindex']::text[],62),
('phosphorus','Phosphorus','mg','sum','nutrition',0,array['phosphorus','phosphorusmg']::text[],63),
('physical_effort','Physical Effort','kcal/hr·kg','avg','activity',0,array['physicaleffort','physicaleffortkcalhrkg']::text[],64),
('polyunsaturated_fat','Polyunsaturated Fat','g','sum','nutrition',0,array['polyunsaturatedfat','polyunsaturatedfatg']::text[],65),
('potassium','Potassium','mg','sum','nutrition',0,array['potassium','potassiummg']::text[],66),
('protein','Protein','g','sum','nutrition',1,array['protein','proteing']::text[],67),
('push_count','Push Count','','sum','sport',0,array['pushcount','pushcountcount']::text[],68),
('recovery_hrv','Recovery HRV','ms','avg','heart',0,array['recoveryhrv','recoveryhrvms']::text[],69),
('respRate','Respiratory Rate','breaths/min','avg','vitals',0,array['respiratoryrate','respiratoryratecountmin','resprate']::text[],70),
('basalKcal','Resting Energy','kcal','sum','activity',0,array['basalkcal','restingenergy','restingenergykj']::text[],71),
('restingHR','Resting Heart Rate','bpm','avg','heart',-1,array['restingheartrate','restingheartratecountmin','restinghr']::text[],72),
('riboflavin','Riboflavin','mg','sum','nutrition',0,array['riboflavin','riboflavinmg']::text[],73),
('running_ground_contact_time','Running Ground Contact Time','ms','avg','sport',0,array['runninggroundcontacttime','runninggroundcontacttimems']::text[],74),
('running_power','Running Power','W','avg','sport',0,array['runningpower','runningpowerw']::text[],75),
('running_speed','Running Speed','km/hr','avg','sport',0,array['runningspeed','runningspeedkmhr']::text[],76),
('running_stride_length','Running Stride Length','m','avg','sport',0,array['runningstridelength','runningstridelengthm']::text[],77),
('running_vertical_oscillation','Running Vertical Oscillation','cm','avg','sport',0,array['runningverticaloscillation','runningverticaloscillationcm']::text[],78),
('saturated_fat','Saturated Fat','g','sum','nutrition',0,array['saturatedfat','saturatedfatg']::text[],79),
('selenium','Selenium','mcg','sum','nutrition',0,array['selenium','seleniummcg']::text[],80),
('sexual_activity_unspecified','Sexual Activity · Unspecified','','sum','private',0,array['sexualactivityunspecified','sexualactivityunspecifiedcount']::text[],81),
('sexual_activity_protection_used','Sexual Activity · Protection Used','','sum','private',0,array['sexualactivityprotectionused','sexualactivityprotectionusedcount']::text[],82),
('sexual_activity_protection_not_used','Sexual Activity · Protection Not Used','','sum','private',0,array['sexualactivityprotectionnotused','sexualactivityprotectionnotusedcount']::text[],83),
('six_minute_walking_test_distance','Six-Minute Walking Test Distance','m','last','mobility',1,array['sixminutewalkingtestdistance','sixminutewalkingtestdistancem']::text[],84),
('sleepAsleep','Sleep · Asleep','min','minutes','sleep',0,array['sleepanalysisasleep','sleepanalysisasleephr','sleepasleep']::text[],85),
('sleepInBed','Sleep · In Bed','min','minutes','sleep',0,array['sleepanalysisinbed','sleepanalysisinbedhr','sleepinbed']::text[],86),
('sleepCore','Sleep · Core','min','minutes','sleep',0,array['sleepanalysiscore','sleepanalysiscorehr','sleepcore']::text[],87),
('sleepDeep','Sleep · Deep','min','minutes','sleep',1,array['sleepanalysisdeep','sleepanalysisdeephr','sleepdeep']::text[],88),
('sleepREM','Sleep · REM','min','minutes','sleep',1,array['sleepanalysisrem','sleepanalysisremhr','sleeprem']::text[],89),
('sleepAwake','Sleep · Awake','min','minutes','sleep',-1,array['sleepanalysisawake','sleepanalysisawakehr','sleepawake']::text[],90),
('sodium','Sodium','mg','sum','nutrition',0,array['sodium','sodiummg']::text[],91),
('stair_speed_down','Stair Speed: Down','m/s','avg','mobility',1,array['stairspeeddown','stairspeeddownms']::text[],92),
('stair_speed_up','Stair Speed: Up','m/s','avg','mobility',1,array['stairspeedup','stairspeedupms']::text[],93),
('steps','Step Count','','sum','activity',1,array['stepcount','stepcountcount','steps']::text[],94),
('sugar','Sugar','g','sum','nutrition',0,array['sugar','sugarg']::text[],95),
('swimming_distance','Swimming Distance','m','sum','sport',0,array['swimmingdistance','swimmingdistancem']::text[],96),
('swimming_stroke_count','Swimming Stroke Count','','sum','sport',0,array['swimmingstrokecount','swimmingstrokecountcount']::text[],97),
('thiamin','Thiamin','mg','sum','nutrition',0,array['thiamin','thiaminmg']::text[],98),
('daylightMin','Time in Daylight','min','sum','environment',1,array['daylightmin','timeindaylight','timeindaylightmin']::text[],99),
('toothbrushing','Toothbrushing','s','sum','mind',0,array['toothbrushing','toothbrushings']::text[],100),
('fat','Total Fat','g','sum','nutrition',0,array['fat','totalfat','totalfatg']::text[],101),
('uv_exposure','UV Exposure','','avg','environment',0,array['uvexposure','uvexposurecount']::text[],102),
('underwater_depth','Underwater Depth','m','avg','sport',0,array['underwaterdepth','underwaterdepthm']::text[],103),
('underwater_temperature','Underwater Temperature','°C','avg','sport',0,array['underwatertemperature','underwatertemperaturedegc']::text[],104),
('vo2max','VO2 Max','mL/kg/min','last','heart',1,array['vo2max','vo2maxmlkgmin']::text[],105),
('vitamin_a','Vitamin A','mcg','sum','nutrition',0,array['vitamina','vitaminamcg']::text[],106),
('vitamin_b12','Vitamin B12','mcg','sum','nutrition',0,array['vitaminb12','vitaminb12mcg']::text[],107),
('vitamin_b6','Vitamin B6','mg','sum','nutrition',0,array['vitaminb6','vitaminb6mg']::text[],108),
('vitamin_c','Vitamin C','mg','sum','nutrition',0,array['vitaminc','vitamincmg']::text[],109),
('vitamin_d','Vitamin D','mcg','sum','nutrition',0,array['vitamind','vitamindmcg']::text[],110),
('vitamin_e','Vitamin E','mg','sum','nutrition',0,array['vitamine','vitaminemg']::text[],111),
('vitamin_k','Vitamin K','mcg','sum','nutrition',0,array['vitamink','vitaminkmcg']::text[],112),
('waist','Waist Circumference','cm','last','body',0,array['waist','waistcircumference','waistcircumferencecm']::text[],113),
('distance','Walking + Running Distance','km','sum','activity',1,array['distance','walkingrunningdistance','walkingrunningdistancekm']::text[],114),
('walking_asymmetry_percentage','Walking Asymmetry Percentage','%','avg','mobility',-1,array['walkingasymmetrypercentage']::text[],115),
('walking_double_support_percentage','Walking Double Support Percentage','%','avg','mobility',-1,array['walkingdoublesupportpercentage']::text[],116),
('walkingHR','Walking Heart Rate Average','bpm','avg','heart',-1,array['walkingheartrateaverage','walkingheartrateaveragecountmin','walkinghr']::text[],117),
('walking_speed','Walking Speed','km/hr','avg','mobility',1,array['walkingspeed','walkingspeedkmhr']::text[],118),
('walking_step_length','Walking Step Length','cm','avg','mobility',1,array['walkingsteplength','walkingsteplengthcm']::text[],119),
('water','Water','mL','sum','nutrition',1,array['water','waterml']::text[],120),
('weight','Weight','kg','last','body',-1,array['weight','weightkg']::text[],121),
('wheelchair_distance','Wheelchair Distance','km','sum','sport',0,array['wheelchairdistance','wheelchairdistancekm']::text[],122),
('zinc','Zinc','mg','sum','nutrition',0,array['zinc','zincmg']::text[],123)
on conflict (key) do update set label=excluded.label, unit=excluded.unit, agg=excluded.agg, category=excluded.category, better=excluded.better, aliases=excluded.aliases, sort=excluded.sort;

-- Daily totals. A day exported by Health Auto Export as a daily summary ("HAE history") is Apple's own
-- de-duplicated figure, so it wins over finer samples for that day and metric.
create or replace function public.health_rollup(p_user uuid, p_from date, p_to date)
returns void language sql security definer set search_path = '' as $$
  delete from public.health_daily d where d.user_id = p_user and d.day between p_from and p_to;
  with s as (
    select s.*, bool_or(s.source = 'HAE history') over (partition by s.day, s.metric) as has_hist
    from public.health_samples s where s.user_id = p_user and s.day between p_from and p_to)
  insert into public.health_daily(user_id, day, metric, value, min_value, max_value, samples)
  select s.user_id, s.day, s.metric,
    case coalesce(m.agg, 'avg')
      when 'sum' then sum(s.value)
      when 'minutes' then sum(s.value)
      when 'last' then (array_agg(s.value order by s.end_at desc))[1]
      when 'min' then min(s.value)
      when 'max' then max(s.value)
      else avg(s.value) end,
    min(s.value), max(s.value), count(*)
  from s left join public.health_metrics m on m.key = s.metric
  where (s.source = 'HAE history') = s.has_hist
  group by s.user_id, s.day, s.metric, m.agg;
$$;
revoke execute on function public.health_rollup(uuid, date, date) from public, anon, authenticated;

-- One row per metric: latest value, this month vs last month, the year's average.
create or replace function public.health_summary()
returns table(metric text, latest double precision, latest_day date, avg30 double precision, prev30 double precision, avg365 double precision, days int, first_day date)
language sql stable security invoker set search_path = '' as $$
  select d.metric, (array_agg(d.value order by d.day desc))[1], max(d.day),
    avg(d.value) filter (where d.day > current_date - 30),
    avg(d.value) filter (where d.day <= current_date - 30 and d.day > current_date - 60),
    avg(d.value) filter (where d.day > current_date - 365),
    count(*)::int, min(d.day)
  from public.health_daily d where d.user_id = auth.uid() group by d.metric;
$$;
revoke execute on function public.health_summary() from public, anon;
grant execute on function public.health_summary() to authenticated;

-- Energy arrived in kilojoules before conversion was added.
update public.health_samples set value = value / 4.184, unit = 'kcal' where unit ilike 'kj';

-- Many daily series in one call, for the Health page and the biological-age trend.
create or replace function public.health_series(p_metrics text[], p_from date)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select coalesce(jsonb_object_agg(metric, pts), '{}'::jsonb) from (
    select d.metric, jsonb_agg(jsonb_build_array(d.day, round(d.value::numeric, 3)) order by d.day) pts
    from public.health_daily d where d.user_id = auth.uid() and d.metric = any(p_metrics) and d.day >= p_from
    group by d.metric) t;
$$;
revoke execute on function public.health_series(text[], date) from public, anon;
grant execute on function public.health_series(text[], date) to authenticated;
