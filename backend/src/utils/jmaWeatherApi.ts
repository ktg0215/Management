// 日本気象庁（JMA）の天気データを取得するユーティリティ
// 気象庁のJSON APIを使用して天気予報を取得

import https from 'https';

// 富山県の地域コード（気象庁の天気予報JSON APIで使用）
const TOYAMA_AREA_CODE = '160000'; // 富山県

// 天気コードの日本語変換テーブル
const WEATHER_CODE_MAP: Record<string, string> = {
  '100': '快晴', // 気象庁のコード100は「快晴」
  '101': '晴れ時々曇り',
  '102': '晴れ一時雨',
  '103': '晴れ一時雪',
  '104': '晴れのち曇り',
  '105': '晴れのち雨',
  '106': '晴れのち雪',
  '110': '晴れ時々曇り',
  '111': '晴れ時々雨',
  '112': '晴れ時々雪',
  '113': '晴れのち曇り',
  '114': '晴れのち雨',
  '115': '晴れのち雪',
  '200': '曇り',
  '201': '曇り時々晴れ',
  '202': '曇り一時雨',
  '203': '曇り一時雪',
  '204': '曇り時々雨',
  '205': '曇り時々雪',
  '206': '曇りのち晴れ',
  '207': '曇りのち雨',
  '208': '曇りのち雪',
  '300': '雨',
  '301': '雨時々止む',
  '302': '雨一時雪',
  '303': '雨のち晴れ',
  '304': '雨のち曇り',
  '305': '雨のち雪',
  '306': '雨時々雪',
  '308': '雨一時強く降る',
  '309': '弱い雨',
  '400': '雪',
  '401': '雪時々止む',
  '402': '雪一時雨',
  '403': '雪のち晴れ',
  '404': '雪のち曇り',
  '405': '雪のち雨',
  '406': '雪時々雨',
  '407': '弱い雪',
};

// 天気コードのマッピングを拡張（気象庁の実際のコードに対応）
const EXTENDED_WEATHER_CODE_MAP: Record<string, string> = {
  ...WEATHER_CODE_MAP,
  '302': '雨か雪',
  '207': '曇り時々雨か雪',
  '101': '晴れ時々曇り',
  '201': '曇り時々晴れ',
  '202': '曇り一時雨',
  '206': '曇りのち晴れ',
  '260': '雨', // 追加のコード
};

interface JMAWeatherData {
  weather: string;
  temperature: number | null; // 平均気温
  temperatureMax: number | null; // 最高気温
  temperatureMin: number | null; // 最低気温
  precipitation: number | null;
  humidity: number | null;
  snow: number | null;
  date: string; // YYYY-MM-DD形式
}

// 気象庁のJSON APIレスポンスの型定義
interface JMAForecastResponse extends Array<{
  publishingOffice: string;
  reportDatetime: string;
  timeSeries: Array<{
    timeDefines: string[];
    areas: Array<{
      area: {
        name: string;
        code: string;
      };
      weathers?: string[];
      weatherCodes?: string[];
      temps?: string[];
      tempsMin?: string[];
      tempsMax?: string[];
      pops?: string[];
    }>;
  }>;
}> {}

/**
 * 気象庁の天気予報JSON APIからデータを取得する
 * @param areaCode 地域コード（例: '160000' = 富山県）
 * @param targetDate 取得する日付（未来の日付のみ、オプション）
 * @returns 天気データの配列（最大7日分）
 */
export async function fetchJMAWeatherForecast(
  areaCode: string = TOYAMA_AREA_CODE,
  targetDate?: Date
): Promise<JMAWeatherData[]> {
  return new Promise((resolve, reject) => {
    // 気象庁の天気予報JSON API
    // URL: https://www.jma.go.jp/bosai/forecast/data/forecast/{地域コード}.json
    const url = `https://www.jma.go.jp/bosai/forecast/data/forecast/${areaCode}.json`;
    
    console.log(`[JMA API] 天気予報取得開始: 地域コード=${areaCode}, URL=${url}`);
    
    https.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          if (res.statusCode !== 200) {
            console.error(`[JMA API] HTTPエラー: ${res.statusCode}, レスポンス: ${data.substring(0, 500)}`);
            reject(new Error(`HTTPエラー: ${res.statusCode}`));
            return;
          }
          
          const forecastData: JMAForecastResponse = JSON.parse(data);
          console.log(`[JMA API] JSONデータを取得しました: 配列長=${forecastData.length}`);
          
          const weatherDataList: JMAWeatherData[] = [];
          
          // 気象庁のJSONデータ構造をパース
          // 構造: [{ publishingOffice, reportDatetime, timeSeries: [...] }]
          // 2番目の要素が週間予報（7日分）を含むことが多い
          
          // 週間予報データを探す（7日分のデータを含む要素）
          let weeklyForecastData: any = null;
          for (const officeData of forecastData) {
            const timeSeries = officeData.timeSeries || [];
            
            for (const series of timeSeries) {
              if (series.areas && series.areas.length > 0) {
                const area = series.areas[0];
                // 週間予報はweatherCodesとpops、tempsMin/tempsMaxが含まれる
                if (area.weatherCodes && series.timeDefines && series.timeDefines.length >= 7) {
                  weeklyForecastData = { officeData, series, area };
                  break;
                }
              }
            }
            if (weeklyForecastData) break;
          }
          
          if (weeklyForecastData) {
            // 週間予報データを処理
            const { series, area, officeData } = weeklyForecastData;
            const timeDefines = series.timeDefines || [];
            const weatherCodes = area.weatherCodes || [];
            const pops = area.pops || [];
            
            // 気温データを取得（別のtimeSeriesから）
            let tempsMinData: string[] = [];
            let tempsMaxData: string[] = [];
            for (const tempSeries of officeData.timeSeries) {
              if (tempSeries.areas && tempSeries.areas.length > 0) {
                const tempArea = tempSeries.areas[0];
                if (tempArea.tempsMin && tempArea.tempsMin.length > 0) {
                  tempsMinData = tempArea.tempsMin;
                }
                if (tempArea.tempsMax && tempArea.tempsMax.length > 0) {
                  tempsMaxData = tempArea.tempsMax;
                }
              }
            }
            
            // 日付ごとにデータを整理
            for (let i = 0; i < timeDefines.length; i++) {
              const timeDefine = timeDefines[i];
              // タイムゾーンを考慮して日付をパース
              const date = new Date(timeDefine);
              
              // 指定された日付に一致する場合のみ取得（指定がない場合はすべて取得）
              if (targetDate) {
                const targetDateStr = targetDate.toISOString().split('T')[0];
                const dateStr = date.toISOString().split('T')[0];
                if (targetDateStr !== dateStr) {
                  continue;
                }
              }
              
              const weatherCode = weatherCodes[i] || '';
              const weather = translateWeatherCode(weatherCode);
              const tempMinStr = tempsMinData[i] || '';
              const tempMaxStr = tempsMaxData[i] || '';
              const tempMin = tempMinStr ? parseFloat(tempMinStr) : null;
              const tempMax = tempMaxStr ? parseFloat(tempMaxStr) : null;
              const tempAvg = (tempMin !== null && tempMax !== null) ? (tempMin + tempMax) / 2 : (tempMax || tempMin);
              
              weatherDataList.push({
                weather: weather,
                temperature: tempAvg !== null ? Math.round(tempAvg) : null,
                temperatureMax: tempMax !== null ? Math.round(tempMax) : null,
                temperatureMin: tempMin !== null ? Math.round(tempMin) : null,
                precipitation: null, // 気象庁のAPIでは降水量は別途取得が必要（popは降水確率）
                humidity: null, // 気象庁のAPIでは湿度は別途取得が必要
                snow: null, // 気象庁のAPIでは降雪量は別途取得が必要
                date: date.toISOString().split('T')[0]
              });
            }
          } else {
            // 短期予報データを処理（3日分）
            for (const officeData of forecastData) {
              const timeSeries = officeData.timeSeries || [];
              
              let weathers: string[] = [];
              let weatherCodes: string[] = [];
              let temps: string[] = [];
              let tempsMin: string[] = [];
              let tempsMax: string[] = [];
              let timeDefines: string[] = [];
              
              for (const series of timeSeries) {
                if (series.areas && series.areas.length > 0) {
                  const area = series.areas[0]; // 最初のエリアを使用
                  
                  if (area.weathers && series.timeDefines) {
                    weathers = area.weathers;
                    weatherCodes = area.weatherCodes || [];
                    if (!timeDefines.length) {
                      timeDefines = series.timeDefines;
                    }
                  } else if (area.temps && series.timeDefines) {
                    temps = area.temps;
                    if (!timeDefines.length) {
                      timeDefines = series.timeDefines;
                    }
                  } else if (area.tempsMin && series.timeDefines) {
                    tempsMin = area.tempsMin;
                    if (!timeDefines.length) {
                      timeDefines = series.timeDefines;
                    }
                  } else if (area.tempsMax && series.timeDefines) {
                    tempsMax = area.tempsMax;
                    if (!timeDefines.length) {
                      timeDefines = series.timeDefines;
                    }
                  }
                }
              }
              
              // 日付ごとにデータを整理
              for (let i = 0; i < timeDefines.length; i++) {
                const timeDefine = timeDefines[i];
                const date = new Date(timeDefine);
                
                // 指定された日付に一致する場合のみ取得（指定がない場合はすべて取得）
                if (targetDate) {
                  const targetDateStr = targetDate.toISOString().split('T')[0];
                  const dateStr = date.toISOString().split('T')[0];
                  if (targetDateStr !== dateStr) {
                    continue;
                  }
                }
                
                const weatherCode = weatherCodes[i] || '';
                const weather = weatherCode ? translateWeatherCode(weatherCode) : translateWeatherText(weathers[i] || '');
                const tempStr = temps[i] || '';
                const tempMinStr = tempsMin[i] || '';
                const tempMaxStr = tempsMax[i] || '';
                const temp = tempStr ? parseFloat(tempStr) : null;
                const tempMin = tempMinStr ? parseFloat(tempMinStr) : null;
                const tempMax = tempMaxStr ? parseFloat(tempMaxStr) : null;
                const tempAvg = temp || (tempMin !== null && tempMax !== null ? (tempMin + tempMax) / 2 : (tempMax || tempMin));
                
                weatherDataList.push({
                  weather: weather,
                  temperature: tempAvg !== null ? Math.round(tempAvg) : null,
                  temperatureMax: tempMax !== null ? Math.round(tempMax) : null,
                  temperatureMin: tempMin !== null ? Math.round(tempMin) : null,
                  precipitation: null,
                  humidity: null,
                  snow: null,
                  date: date.toISOString().split('T')[0]
                });
              }
            }
          }
          
          console.log(`[JMA API] 取得したデータ数: ${weatherDataList.length}件`);
          resolve(weatherDataList);
        } catch (err) {
          console.error('[JMA API] JSONパースエラー:', err);
          console.error('[JMA API] レスポンスデータ:', data.substring(0, 1000));
          reject(err);
        }
      });
    }).on('error', (err) => {
      console.error('[JMA API] ネットワークエラー:', err);
      reject(err);
    });
  });
}

/**
 * 気象庁の天気テキストを標準化された日本語に変換
 * @param weatherText 気象庁の天気テキスト
 * @returns 標準化された天気表現
 */
function translateWeatherText(weatherText: string): string {
  if (!weatherText) return '';
  
  // 気象庁の天気表現を標準化
  const translations: Record<string, string> = {
    '晴': '晴れ',
    '晴れ': '晴れ',
    '曇': '曇り',
    '曇り': '曇り',
    '雨': '雨',
    '雪': '雪',
    '晴時々曇': '晴れ時々曇り',
    '晴のち曇': '晴れのち曇り',
    '曇時々晴': '曇り時々晴れ',
    '曇のち晴': '曇りのち晴れ',
    '雨時々曇': '雨時々曇り',
    '雨のち晴': '雨のち晴れ',
    '雪時々曇': '雪時々曇り',
    '雪のち晴': '雪のち晴れ',
  };
  
  // 完全一致をチェック
  if (translations[weatherText]) {
    return translations[weatherText];
  }
  
  // 部分一致をチェック
  for (const [key, value] of Object.entries(translations)) {
    if (weatherText.includes(key)) {
      return value;
    }
  }
  
  // 変換できない場合はそのまま返す
  return weatherText;
}

/**
 * 気象庁の過去データを取得する
 * 注意: 気象庁の過去データはJSON APIで提供されていないため、
 * CSV/XLSXファイルからインポートする必要がある
 * @param date 取得する日付（過去の日付）
 * @returns 天気データ（nullを返す - データベースから取得する必要がある）
 */
export async function fetchJMAPastWeather(date: Date): Promise<JMAWeatherData | null> {
  // 気象庁の過去データはJSON APIで提供されていないため、
  // データベースから取得する（既にCSV/XLSXファイルからインポート済み）
  console.log(`[JMA API] 過去データ取得: 日付=${date.toISOString()}`);
  console.log('[JMA API] 過去データはデータベースから取得してください（CSV/XLSXファイルからインポート済み）');
  return null;
}

/**
 * 指定された日付の天気予報を取得する（単一日付用）
 * @param areaCode 地域コード
 * @param date 取得する日付
 * @returns 天気データ（見つからない場合はnull）
 */
export async function fetchJMAWeatherForDate(
  areaCode: string = TOYAMA_AREA_CODE,
  date: Date
): Promise<JMAWeatherData | null> {
  const forecastList = await fetchJMAWeatherForecast(areaCode, date);
  return forecastList.length > 0 ? forecastList[0] : null;
}

/**
 * 天気コードを日本語に変換
 * @param code 天気コード（3桁の文字列、例: '101', '207'）
 * @returns 日本語の天気表現
 */
export function translateWeatherCode(code: string): string {
  if (!code) return '';
  
  // 拡張マップを先にチェック
  if (EXTENDED_WEATHER_CODE_MAP[code]) {
    return EXTENDED_WEATHER_CODE_MAP[code];
  }
  
  // 3桁のコードを変換
  if (WEATHER_CODE_MAP[code]) {
    return WEATHER_CODE_MAP[code];
  }
  
  // 2桁のコードも試す（先頭の'1'を削除）
  if (code.length === 3 && code.startsWith('1')) {
    const twoDigitCode = code.substring(1);
    if (WEATHER_CODE_MAP[twoDigitCode]) {
      return WEATHER_CODE_MAP[twoDigitCode];
    }
  }
  
  // 変換できない場合は空文字を返す
  return '';
}


