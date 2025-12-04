import React, { useMemo, memo } from 'react';
import { Edit2, Sun, Cloud, CloudRain, CloudSnow, CloudLightning, CloudDrizzle } from 'lucide-react';
import { formatNumber, isSaturday, isSunday } from '../../utils/salesUtils';

interface SimpleDailySalesData {
  date: string;
  dayOfWeek: string;
  // 売上・目標関連
  salesTarget?: number;
  targetCumulative?: number;
  targetRatio?: number;
  yearOverYear?: number;
  edwYearOverYear?: number;
  ohbYearOverYear?: number;
  aggregator?: string;
  // 店舗純売上
  netSales?: number;
  netSalesCumulative?: number;
  // EDW・OHB売上
  edwNetSales?: number;
  edwNetSalesCumulative?: number;
  ohbNetSales?: number;
  ohbNetSalesCumulative?: number;
  // 客数・組数
  totalGroups?: number;
  totalCustomers?: number;
  groupUnitPrice?: number;
  customerUnitPrice?: number;
  // 人件費関連
  katougi?: number;
  ishimori?: number;
  osawa?: number;
  washizuka?: number;
  employeeHours?: number;
  asHours?: number;
  salesPerHour?: number;
  laborCost?: number;
  laborCostRate?: number;
  // EDW営業明細
  lunchSales?: number;
  dinnerSales?: number;
  lunchCustomers?: number;
  dinnerCustomers?: number;
  lunchGroups?: number;
  dinnerGroups?: number;
  edwCustomerUnitPrice?: number;
  lunchUnitPrice?: number;
  dinnerUnitPrice?: number;
  // OHB
  ohbSales?: number;
  ohbCustomers?: number;
  ohbGroups?: number;
  ohbCustomerUnitPrice?: number;
  // VOID関連
  voidCount?: number;
  voidAmount?: number;
  salesDiscrepancy?: number;
  // 生産性
  totalHours?: number;
  edwBaitHours?: number;
  ohbBaitHours?: number;
  edwProductivity?: number;
  ohbProductivity?: number;
  totalProductivity?: number;
  // OHB予約
  reservationCount?: number;
  plain?: number;
  junsei?: number;
  seasonal?: number;
  // アンケート
  surveyCount?: number;
  surveyRate?: number;
  // 旧フィールド（互換性のため）
  revenue?: number;
  cost?: number;
  profit?: number;
  // 天気・イベント関連
  weather?: string;
  temperature?: number | null;
  event?: string;
  // 予測フラグ
  is_predicted?: boolean;
}

interface SimpleSalesTableProps {
  dailyData: { [date: string]: SimpleDailySalesData };
  hasData: (date: string) => boolean;
  onEditClick: (date: string) => void;
  currentYear: number;
  currentMonth: number;
}

const SimpleSalesTable: React.FC<SimpleSalesTableProps> = memo(({
  dailyData,
  hasData,
  onEditClick,
  currentYear,
  currentMonth,
}) => {
  // Debug logging
  console.log('[SimpleSalesTable] Rendering with props:', {
    dailyDataKeys: Object.keys(dailyData || {}).length,
    sampleKeys: Object.keys(dailyData || {}).slice(0, 3),
    currentYear,
    currentMonth
  });

  // Memoize sorted dates to prevent unnecessary recalculation
  const sortedDates = useMemo(() => {
    const sorted = Object.keys(dailyData).sort();
    console.log('[SimpleSalesTable] Sorted dates count:', sorted.length);
    return sorted;
  }, [dailyData]);

  // ブラウザモードでも確実に黒色を適用するためのインラインスタイル
  const cellTextStyle: React.CSSProperties = { color: '#111827' };

  const getCellClassName = (date: string, dayOfWeek: string, index: number) => {
    const baseClass = "px-1 py-1 text-right border-r border-gray-200 text-xs whitespace-nowrap text-gray-900";
    const isEvenRow = index % 2 === 0;

    if (isSaturday(dayOfWeek)) {
      return `${baseClass} ${isEvenRow ? 'bg-blue-50' : 'bg-blue-100'}`;
    } else if (isSunday(dayOfWeek)) {
      return `${baseClass} ${isEvenRow ? 'bg-red-50' : 'bg-red-100'}`;
    } else {
      return `${baseClass} ${isEvenRow ? 'bg-white' : 'bg-gray-50'}`;
    }
  };

  const getDateCellClassName = (date: string, dayOfWeek: string, index: number) => {
    const baseClass = "px-1 py-1 text-center font-medium border-r border-gray-300 text-xs text-gray-900";
    const isEvenRow = index % 2 === 0;

    if (isSaturday(dayOfWeek)) {
      return `${baseClass} ${isEvenRow ? 'bg-blue-50' : 'bg-blue-100'}`;
    } else if (isSunday(dayOfWeek)) {
      return `${baseClass} ${isEvenRow ? 'bg-red-50' : 'bg-red-100'}`;
    } else {
      return `${baseClass} ${isEvenRow ? 'bg-white' : 'bg-gray-50'}`;
    }
  };

  const getDayOfWeekCellClassName = (date: string, dayOfWeek: string, index: number) => {
    const baseClass = "px-1 py-1 text-center font-medium border-r border-gray-300 text-xs";
    const isEvenRow = index % 2 === 0;

    if (isSaturday(dayOfWeek)) {
      return `${baseClass} ${isEvenRow ? 'bg-blue-50' : 'bg-blue-100'} text-blue-700`;
    } else if (isSunday(dayOfWeek)) {
      return `${baseClass} ${isEvenRow ? 'bg-red-50' : 'bg-red-100'} text-red-700`;
    } else {
      return `${baseClass} ${isEvenRow ? 'bg-white' : 'bg-gray-50'}`;
    }
  };

  const getActionCellClassName = (index: number) => {
    const baseClass = "px-1 py-1 text-center border-l border-gray-200 text-gray-900";
    const isEvenRow = index % 2 === 0;
    return `${baseClass} ${isEvenRow ? 'bg-white' : 'bg-gray-50'}`;
  };

  const formatValue = (value: any, isPredicted: boolean = false) => {
    if (value === undefined || value === null || value === '') return '-';
    const formatted = typeof value === 'number' ? formatNumber(value) : String(value);
    if (isPredicted) {
      return <span className="text-blue-600 font-medium">{formatted}</span>;
    }
    return formatted;
  };

  const formatPercent = (value: any, isPredicted: boolean = false) => {
    if (value === undefined || value === null || value === '') return '-';
    const formatted = typeof value === 'number' ? `${value.toFixed(1)}%` : String(value);
    if (isPredicted) {
      return <span className="text-blue-600 font-medium">{formatted}</span>;
    }
    return formatted;
  };

  const formatDecimal = (value: any, isPredicted: boolean = false) => {
    if (value === undefined || value === null || value === '') return '-';
    const formatted = typeof value === 'number' ? value.toFixed(1) : String(value);
    if (isPredicted) {
      return <span className="text-blue-600 font-medium">{formatted}</span>;
    }
    return formatted;
  };

  // 天気アイコンを取得
  const getWeatherIcon = (weather: string | undefined) => {
    // デバッグ: 関数が呼ばれたことを確認
    console.log(`[getWeatherIcon] 関数呼び出し: weather="${weather}", type=${typeof weather}, length=${weather?.length || 0}`);
    
    // undefinedまたはnullの場合はnullを返す
    if (weather === undefined || weather === null) {
      console.log(`[getWeatherIcon] 天気データがundefined/nullのためnullを返します`);
      return null;
    }
    
    // 空文字列の場合はnullを返す
    if (weather.trim() === '') {
      console.log(`[getWeatherIcon] 天気データが空文字列のためnullを返します`);
      return null;
    }
    
    const weatherLower = weather.toLowerCase();
    const iconClass = "w-4 h-4 inline-block";
    
    // デバッグ: すべての天気文字列をログ出力
    console.log(`[getWeatherIcon] 天気文字列: "${weather}" (lowercase: "${weatherLower}")`);
    
    // 「晴れ時々曇り」や「晴れのち曇り」の場合、太陽と曇りのアイコンを2つ並べて表示
    // より柔軟な判定: 「晴れ」と「時々」または「のち」と「曇」を含む場合
    // 注意: toLowerCase()は日本語には影響しないが、念のため元の文字列もチェック
    const hasHare = weather.includes('晴れ') || weatherLower.includes('晴れ');
    const hasTokidoki = weather.includes('時々') || weatherLower.includes('時々');
    const hasNochi = weather.includes('のち') || weatherLower.includes('のち');
    const hasKumori = weather.includes('曇') || weatherLower.includes('曇');
    const isPartiallyCloudy = weatherLower.includes('partially cloudy');
    
    // デバッグ: 文字列の詳細を確認
    console.log(`[getWeatherIcon] 判定チェック: weather="${weather}", weather.length=${weather.length}, weatherLower="${weatherLower}", weatherLower.length=${weatherLower.length}`);
    console.log(`[getWeatherIcon] 文字コード: ${Array.from(weather).map((char, i) => `${i}:${char.charCodeAt(0)}`).join(', ')}`);
    console.log(`[getWeatherIcon] hasHare=${hasHare}, hasTokidoki=${hasTokidoki}, hasNochi=${hasNochi}, hasKumori=${hasKumori}, isPartiallyCloudy=${isPartiallyCloudy}`);
    
    // 「晴れ時々曇り」や「晴れのち曇り」を最初にチェック（他の条件より優先）
    if (isPartiallyCloudy ||
        (hasHare && (hasTokidoki || hasNochi) && hasKumori)) {
      console.log(`[getWeatherIcon] 晴れ時々曇りを検出: "${weather}"`);
      return (
        <div className="flex items-center justify-center gap-1 flex-nowrap" style={{ minWidth: '40px' }}>
          <Sun className="w-4 h-4 flex-shrink-0" style={{ color: '#fbbf24', display: 'inline-block' }} />
          <Cloud className="w-4 h-4 flex-shrink-0" style={{ color: '#60a5fa', display: 'inline-block' }} />
        </div>
      );
    }
    
    // 「快晴」を含む場合（最も明るい太陽アイコン）
    if (weather.includes('快晴') || weatherLower.includes('快晴')) {
      console.log(`[getWeatherIcon] 快晴を検出: "${weather}"`);
      return <Sun className={iconClass} style={{ color: '#fbbf24', filter: 'brightness(1.2)' }} />;
    }
    
    // 「晴れ」を含む場合（「晴れ時々曇り」などは上で処理済み）
    if (weatherLower.includes('晴れ') || weatherLower.includes('clear') || weather === '晴') {
      console.log(`[getWeatherIcon] 晴れを検出: "${weather}"`);
      // 純粋な「晴れ」の場合は太陽アイコン
      return <Sun className={iconClass} style={{ color: '#fbbf24' }} />;
    } 
    // 「雨」を含む場合
    else if (weatherLower.includes('雨') || weatherLower.includes('rain')) {
      console.log(`[getWeatherIcon] 雨を検出`);
      if (weatherLower.includes('にわか') || weatherLower.includes('shower')) {
        return <CloudDrizzle className={iconClass} style={{ color: '#3b82f6' }} />;
      }
      return <CloudRain className={iconClass} style={{ color: '#2563eb' }} />;
    } 
    // 「雪」を含む場合
    else if (weatherLower.includes('雪') || weatherLower.includes('snow')) {
      console.log(`[getWeatherIcon] 雪を検出`);
      return <CloudSnow className={iconClass} style={{ color: '#93c5fd' }} />;
    } 
    // 「雷」を含む場合
    else if (weatherLower.includes('雷') || weatherLower.includes('thunder')) {
      console.log(`[getWeatherIcon] 雷を検出`);
      return <CloudLightning className={iconClass} style={{ color: '#7c3aed' }} />;
    } 
    // 「曇り」を含む場合（最後にチェック）
    else if (weatherLower.includes('曇り') || weatherLower.includes('cloudy') || weatherLower.includes('overcast')) {
      console.log(`[getWeatherIcon] 曇りを検出`);
      return <Cloud className={iconClass} style={{ color: '#9ca3af' }} />;
    }
    
    // デフォルト: 不明な天気の場合は曇りアイコンを表示
    console.warn(`[getWeatherIcon] 未対応の天気文字列: "${weather}"`);
    return <Cloud className={iconClass} style={{ color: '#9ca3af' }} />;
  };

  // Memoize expensive cell className calculations
  const memoizedCellData = useMemo(() => {
    return sortedDates.map((date, index) => {
      const data = dailyData[date];
      const day = parseInt(date.split('-')[2]);
      return {
        date,
        data,
        day,
        index,
        dateCellClass: getDateCellClassName(date, data?.dayOfWeek || '', index),
        dayOfWeekCellClass: getDayOfWeekCellClassName(date, data?.dayOfWeek || '', index),
        actionCellClass: getActionCellClassName(index)
      };
    });
  }, [sortedDates, dailyData]);

  // 月間累計を計算
  const monthlySummary = useMemo(() => {
    const dataArray = Object.values(dailyData).filter(d => d && d.netSales !== undefined);
    if (dataArray.length === 0) return null;

    // 合計フィールド
    const sumFields = [
      'netSales', 'edwNetSales', 'ohbNetSales', 'totalGroups', 'totalCustomers',
      'laborCost', 'lunchSales', 'dinnerSales', 'lunchCustomers', 'dinnerCustomers',
      'lunchGroups', 'dinnerGroups', 'ohbSales', 'ohbCustomers', 'ohbGroups',
      'voidCount', 'voidAmount', 'salesDiscrepancy', 'totalHours', 'edwBaitHours', 'ohbBaitHours',
      'reservationCount', 'plain', 'junsei', 'seasonal', 'surveyCount',
      'employeeHours', 'asHours', 'katougi', 'ishimori', 'osawa', 'washizuka', 'salesTarget'
    ];

    // 平均フィールド
    const avgFields = [
      'laborCostRate', 'groupUnitPrice', 'customerUnitPrice', 'edwCustomerUnitPrice',
      'lunchUnitPrice', 'dinnerUnitPrice', 'ohbCustomerUnitPrice',
      'edwProductivity', 'ohbProductivity', 'totalProductivity', 'surveyRate',
      'targetRatio', 'yearOverYear', 'edwYearOverYear', 'ohbYearOverYear'
    ];

    const summary: Record<string, number> = {};

    // 合計を計算
    sumFields.forEach(field => {
      const sum = dataArray.reduce((acc, d) => {
        const val = (d as any)[field];
        return acc + (typeof val === 'number' ? val : 0);
      }, 0);
      summary[field] = sum;
    });

    // 平均を計算
    avgFields.forEach(field => {
      const values = dataArray
        .map(d => (d as any)[field])
        .filter(v => typeof v === 'number' && !isNaN(v));
      if (values.length > 0) {
        summary[field] = values.reduce((a, b) => a + b, 0) / values.length;
      }
    });

    // 累計フィールドは最終日の値を使用
    const lastData = dataArray[dataArray.length - 1] as any;
    if (lastData) {
      ['targetCumulative', 'netSalesCumulative', 'edwNetSalesCumulative', 'ohbNetSalesCumulative'].forEach(field => {
        if (lastData[field] !== undefined) {
          summary[field] = lastData[field];
        }
      });
    }

    // 単価の再計算（合計から算出）
    if (summary.totalGroups > 0) {
      summary.groupUnitPrice = Math.round(summary.netSales / summary.totalGroups);
    }
    if (summary.totalCustomers > 0) {
      summary.customerUnitPrice = Math.round(summary.netSales / summary.totalCustomers);
    }
    if (summary.lunchGroups > 0) {
      summary.lunchUnitPrice = Math.round(summary.lunchSales / summary.lunchGroups);
    }
    if (summary.dinnerGroups > 0) {
      summary.dinnerUnitPrice = Math.round(summary.dinnerSales / summary.dinnerGroups);
    }
    if ((summary.lunchCustomers + summary.dinnerCustomers) > 0) {
      summary.edwCustomerUnitPrice = Math.round((summary.lunchSales + summary.dinnerSales) / (summary.lunchCustomers + summary.dinnerCustomers));
    }
    if (summary.ohbCustomers > 0) {
      summary.ohbCustomerUnitPrice = Math.round(summary.ohbSales / summary.ohbCustomers);
    }

    // 人時売上の再計算
    const totalWorkHours = summary.employeeHours + summary.asHours;
    if (totalWorkHours > 0) {
      summary.salesPerHour = Math.round(summary.netSales / totalWorkHours);
    }

    // 人件費率の再計算
    if (summary.netSales > 0) {
      summary.laborCostRate = (summary.laborCost / summary.netSales) * 100;
    }

    return summary;
  }, [dailyData]);

  return (
    <div className="bg-white border border-gray-200 overflow-hidden rounded-lg shadow">
      {/* Title */}
      <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
        <h2 className="text-lg font-medium text-gray-900">
          {currentYear}年{currentMonth}月の売上データ
        </h2>
        <div className="flex items-center space-x-4 mt-2 text-sm">
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-blue-50 border border-blue-200"></div>
            <span className="text-gray-600">土曜日</span>
          </div>
          <div className="flex items-center space-x-1">
            <div className="w-3 h-3 bg-red-50 border border-red-200"></div>
            <span className="text-gray-600">日曜・祝日</span>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs text-gray-900">
          <thead className="bg-gray-50">
            {/* グループヘッダー */}
            <tr className="border-b border-gray-300">
              <th colSpan={2} className="px-1 py-1 text-center font-medium text-gray-700 border-r border-gray-300 bg-gray-100"></th>
              <th colSpan={2} className="px-1 py-1 text-center font-medium text-gray-700 border-r border-gray-300 bg-blue-100">天気情報</th>
              <th colSpan={6} className="px-1 py-1 text-center font-medium text-gray-700 border-r border-gray-300 bg-yellow-100">目標・前年比</th>
              <th colSpan={6} className="px-1 py-1 text-center font-medium text-gray-700 border-r border-gray-300 bg-green-100">店舗売上</th>
              <th colSpan={4} className="px-1 py-1 text-center font-medium text-gray-700 border-r border-gray-300 bg-gray-100">客数・組数</th>
              <th colSpan={9} className="px-1 py-1 text-center font-medium text-gray-700 border-r border-gray-300 bg-orange-100">人件費</th>
              <th colSpan={9} className="px-1 py-1 text-center font-medium text-gray-700 border-r border-gray-300 bg-cyan-100">EDW営業明細</th>
              <th colSpan={4} className="px-1 py-1 text-center font-medium text-gray-700 border-r border-gray-300 bg-purple-100">OHB</th>
              <th colSpan={3} className="px-1 py-1 text-center font-medium text-gray-700 border-r border-gray-300 bg-red-100">VOID</th>
              <th colSpan={6} className="px-1 py-1 text-center font-medium text-gray-700 border-r border-gray-300 bg-indigo-100">生産性</th>
              <th colSpan={4} className="px-1 py-1 text-center font-medium text-gray-700 border-r border-gray-300 bg-pink-100">OHB予約</th>
              <th colSpan={2} className="px-1 py-1 text-center font-medium text-gray-700 border-r border-gray-300 bg-teal-100">アンケート</th>
              <th colSpan={1} className="px-1 py-1 text-center font-medium text-gray-700 border-r border-gray-300 bg-yellow-100">イベント</th>
              <th className="px-1 py-1 text-center font-medium text-gray-700 bg-gray-100"></th>
            </tr>
            {/* 項目ヘッダー */}
            <tr>
              <th className="px-1 py-1 text-center font-medium text-gray-700 border-r border-gray-300 whitespace-nowrap">日</th>
              <th className="px-1 py-1 text-center font-medium text-gray-700 border-r border-gray-300 whitespace-nowrap">曜</th>
              <th className="px-1 py-1 text-center font-medium text-gray-700 border-r border-gray-300 whitespace-nowrap">天気</th>
              <th className="px-1 py-1 text-center font-medium text-gray-700 border-r border-gray-300 whitespace-nowrap">気温</th>
              {/* 目標・前年比 */}
              <th className="px-1 py-1 text-center font-medium text-gray-700 border-r border-gray-200 whitespace-nowrap bg-yellow-50">売上目標</th>
              <th className="px-1 py-1 text-center font-medium text-gray-700 border-r border-gray-200 whitespace-nowrap bg-yellow-50">目標累計</th>
              <th className="px-1 py-1 text-center font-medium text-gray-700 border-r border-gray-200 whitespace-nowrap bg-yellow-50">対目標比</th>
              <th className="px-1 py-1 text-center font-medium text-gray-700 border-r border-gray-200 whitespace-nowrap bg-yellow-50">前年比</th>
              <th className="px-1 py-1 text-center font-medium text-gray-700 border-r border-gray-200 whitespace-nowrap bg-yellow-50">EDW前年</th>
              <th className="px-1 py-1 text-center font-medium text-gray-700 border-r border-gray-300 whitespace-nowrap bg-yellow-50">OHB前年</th>
              {/* 店舗売上 */}
              <th className="px-1 py-1 text-center font-medium text-gray-700 border-r border-gray-200 whitespace-nowrap bg-green-50">店舗純売上</th>
              <th className="px-1 py-1 text-center font-medium text-gray-700 border-r border-gray-200 whitespace-nowrap bg-green-50">累計</th>
              <th className="px-1 py-1 text-center font-medium text-gray-700 border-r border-gray-200 whitespace-nowrap bg-green-50">EDW売上</th>
              <th className="px-1 py-1 text-center font-medium text-gray-700 border-r border-gray-200 whitespace-nowrap bg-green-50">EDW累計</th>
              <th className="px-1 py-1 text-center font-medium text-gray-700 border-r border-gray-200 whitespace-nowrap bg-green-50">OHB売上</th>
              <th className="px-1 py-1 text-center font-medium text-gray-700 border-r border-gray-300 whitespace-nowrap bg-green-50">OHB累計</th>
              {/* 客数・組数 */}
              <th className="px-1 py-1 text-center font-medium text-gray-700 border-r border-gray-200 whitespace-nowrap">組数</th>
              <th className="px-1 py-1 text-center font-medium text-gray-700 border-r border-gray-200 whitespace-nowrap">客数</th>
              <th className="px-1 py-1 text-center font-medium text-gray-700 border-r border-gray-200 whitespace-nowrap">組単価</th>
              <th className="px-1 py-1 text-center font-medium text-gray-700 border-r border-gray-300 whitespace-nowrap">客単価</th>
              {/* 人件費 */}
              <th className="px-1 py-1 text-center font-medium text-gray-700 border-r border-gray-200 whitespace-nowrap bg-orange-50">加藤木</th>
              <th className="px-1 py-1 text-center font-medium text-gray-700 border-r border-gray-200 whitespace-nowrap bg-orange-50">石森</th>
              <th className="px-1 py-1 text-center font-medium text-gray-700 border-r border-gray-200 whitespace-nowrap bg-orange-50">大澤</th>
              <th className="px-1 py-1 text-center font-medium text-gray-700 border-r border-gray-200 whitespace-nowrap bg-orange-50">鷲塚</th>
              <th className="px-1 py-1 text-center font-medium text-gray-700 border-r border-gray-200 whitespace-nowrap bg-orange-50">社員時間</th>
              <th className="px-1 py-1 text-center font-medium text-gray-700 border-r border-gray-200 whitespace-nowrap bg-orange-50">AS時間</th>
              <th className="px-1 py-1 text-center font-medium text-gray-700 border-r border-gray-200 whitespace-nowrap bg-orange-50">人時売上</th>
              <th className="px-1 py-1 text-center font-medium text-gray-700 border-r border-gray-200 whitespace-nowrap bg-orange-50">人件費</th>
              <th className="px-1 py-1 text-center font-medium text-gray-700 border-r border-gray-300 whitespace-nowrap bg-orange-50">人件費率</th>
              {/* EDW営業明細 */}
              <th className="px-1 py-1 text-center font-medium text-gray-700 border-r border-gray-200 whitespace-nowrap bg-cyan-50">L売上</th>
              <th className="px-1 py-1 text-center font-medium text-gray-700 border-r border-gray-200 whitespace-nowrap bg-cyan-50">D売上</th>
              <th className="px-1 py-1 text-center font-medium text-gray-700 border-r border-gray-200 whitespace-nowrap bg-cyan-50">L客数</th>
              <th className="px-1 py-1 text-center font-medium text-gray-700 border-r border-gray-200 whitespace-nowrap bg-cyan-50">D客数</th>
              <th className="px-1 py-1 text-center font-medium text-gray-700 border-r border-gray-200 whitespace-nowrap bg-cyan-50">L組数</th>
              <th className="px-1 py-1 text-center font-medium text-gray-700 border-r border-gray-200 whitespace-nowrap bg-cyan-50">D組数</th>
              <th className="px-1 py-1 text-center font-medium text-gray-700 border-r border-gray-200 whitespace-nowrap bg-cyan-50">EDW単価</th>
              <th className="px-1 py-1 text-center font-medium text-gray-700 border-r border-gray-200 whitespace-nowrap bg-cyan-50">L単価</th>
              <th className="px-1 py-1 text-center font-medium text-gray-700 border-r border-gray-300 whitespace-nowrap bg-cyan-50">D単価</th>
              {/* OHB */}
              <th className="px-1 py-1 text-center font-medium text-gray-700 border-r border-gray-200 whitespace-nowrap bg-purple-50">売上</th>
              <th className="px-1 py-1 text-center font-medium text-gray-700 border-r border-gray-200 whitespace-nowrap bg-purple-50">客数</th>
              <th className="px-1 py-1 text-center font-medium text-gray-700 border-r border-gray-200 whitespace-nowrap bg-purple-50">組数</th>
              <th className="px-1 py-1 text-center font-medium text-gray-700 border-r border-gray-300 whitespace-nowrap bg-purple-50">単価</th>
              {/* VOID */}
              <th className="px-1 py-1 text-center font-medium text-gray-700 border-r border-gray-200 whitespace-nowrap bg-red-50">件数</th>
              <th className="px-1 py-1 text-center font-medium text-gray-700 border-r border-gray-200 whitespace-nowrap bg-red-50">金額</th>
              <th className="px-1 py-1 text-center font-medium text-gray-700 border-r border-gray-300 whitespace-nowrap bg-red-50">過不足</th>
              {/* 生産性 */}
              <th className="px-1 py-1 text-center font-medium text-gray-700 border-r border-gray-200 whitespace-nowrap bg-indigo-50">総時間</th>
              <th className="px-1 py-1 text-center font-medium text-gray-700 border-r border-gray-200 whitespace-nowrap bg-indigo-50">EDWバイト</th>
              <th className="px-1 py-1 text-center font-medium text-gray-700 border-r border-gray-200 whitespace-nowrap bg-indigo-50">OHBバイト</th>
              <th className="px-1 py-1 text-center font-medium text-gray-700 border-r border-gray-200 whitespace-nowrap bg-indigo-50">EDW生産</th>
              <th className="px-1 py-1 text-center font-medium text-gray-700 border-r border-gray-200 whitespace-nowrap bg-indigo-50">OHB生産</th>
              <th className="px-1 py-1 text-center font-medium text-gray-700 border-r border-gray-300 whitespace-nowrap bg-indigo-50">総生産</th>
              {/* OHB予約 */}
              <th className="px-1 py-1 text-center font-medium text-gray-700 border-r border-gray-200 whitespace-nowrap bg-pink-50">予約数</th>
              <th className="px-1 py-1 text-center font-medium text-gray-700 border-r border-gray-200 whitespace-nowrap bg-pink-50">プレーン</th>
              <th className="px-1 py-1 text-center font-medium text-gray-700 border-r border-gray-200 whitespace-nowrap bg-pink-50">純生</th>
              <th className="px-1 py-1 text-center font-medium text-gray-700 border-r border-gray-300 whitespace-nowrap bg-pink-50">季節</th>
              {/* アンケート */}
              <th className="px-1 py-1 text-center font-medium text-gray-700 border-r border-gray-200 whitespace-nowrap bg-teal-50">枚数</th>
              <th className="px-1 py-1 text-center font-medium text-gray-700 border-r border-gray-300 whitespace-nowrap bg-teal-50">取得率</th>
              {/* イベント */}
              <th className="px-1 py-1 text-center font-medium text-gray-700 border-r border-gray-300 whitespace-nowrap bg-yellow-50">イベント</th>
              {/* 操作 */}
              <th className="px-1 py-1 text-center font-medium text-gray-700 whitespace-nowrap">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-gray-900">
            {memoizedCellData.map(({ date, data, day, index, dateCellClass, dayOfWeekCellClass, actionCellClass }) => {
              // デバッグ: 最初の3日分のis_predictedフラグをログ出力
              if (index < 3 && data) {
                console.log(`[SimpleSalesTable] Row ${index} (${date}): is_predicted=${data.is_predicted}, netSales=${data.netSales}, edwNetSales=${data.edwNetSales}, ohbNetSales=${data.ohbNetSales}`);
              }
              // Debug logging for weather data
              if (index < 3) {
                console.log(`[SimpleSalesTable] Row ${index} (${date}):`, {
                  weather: data?.weather,
                  temperature: data?.temperature,
                  event: data?.event,
                  hasWeather: !!data?.weather,
                  hasTemperature: data?.temperature !== null && data?.temperature !== undefined
                });
              }
              return (
              <tr key={date} className="hover:bg-gray-50">
                <td className={dateCellClass}>{day}</td>
                <td className={dayOfWeekCellClass}>{data?.dayOfWeek || ''}</td>
                <td className={getCellClassName(date, data?.dayOfWeek || '', index)} style={cellTextStyle}>
                  <div className="flex items-center justify-center">
                    {(() => {
                      const weather = data?.weather || '';
                      console.log(`[SimpleSalesTable] Rendering weather icon for ${date}: weather="${weather}", type=${typeof weather}`);
                      return getWeatherIcon(weather);
                    })()}
                  </div>
                </td>
                <td className={getCellClassName(date, data?.dayOfWeek || '', index)} style={cellTextStyle}>
                  {data?.temperature !== null && data?.temperature !== undefined 
                    ? `${Math.round(data.temperature)}°C` 
                    : '-'}
                </td>
                {/* 目標・前年比 */}
                <td className={getCellClassName(date, data?.dayOfWeek || '', index)} style={cellTextStyle}>{formatValue(data?.salesTarget)}</td>
                <td className={getCellClassName(date, data?.dayOfWeek || '', index)} style={cellTextStyle}>{formatValue(data?.targetCumulative)}</td>
                <td className={getCellClassName(date, data?.dayOfWeek || '', index)} style={cellTextStyle}>{formatPercent(data?.targetRatio)}</td>
                <td className={getCellClassName(date, data?.dayOfWeek || '', index)} style={cellTextStyle}>{formatPercent(data?.yearOverYear)}</td>
                <td className={getCellClassName(date, data?.dayOfWeek || '', index)} style={cellTextStyle}>{formatPercent(data?.edwYearOverYear)}</td>
                <td className={getCellClassName(date, data?.dayOfWeek || '', index)} style={cellTextStyle}>{formatPercent(data?.ohbYearOverYear)}</td>
                {/* 店舗売上 */}
                <td className={getCellClassName(date, data?.dayOfWeek || '', index)} style={cellTextStyle}>{formatValue(data?.netSales, data?.is_predicted)}</td>
                <td className={getCellClassName(date, data?.dayOfWeek || '', index)} style={cellTextStyle}>{formatValue(data?.netSalesCumulative, data?.is_predicted)}</td>
                <td className={getCellClassName(date, data?.dayOfWeek || '', index)} style={cellTextStyle}>{formatValue(data?.edwNetSales, data?.is_predicted)}</td>
                <td className={getCellClassName(date, data?.dayOfWeek || '', index)} style={cellTextStyle}>{formatValue(data?.edwNetSalesCumulative, data?.is_predicted)}</td>
                <td className={getCellClassName(date, data?.dayOfWeek || '', index)} style={cellTextStyle}>{formatValue(data?.ohbNetSales, data?.is_predicted)}</td>
                <td className={getCellClassName(date, data?.dayOfWeek || '', index)} style={cellTextStyle}>{formatValue(data?.ohbNetSalesCumulative, data?.is_predicted)}</td>
                {/* 客数・組数 */}
                <td className={getCellClassName(date, data?.dayOfWeek || '', index)} style={cellTextStyle}>{formatValue(data?.totalGroups)}</td>
                <td className={getCellClassName(date, data?.dayOfWeek || '', index)} style={cellTextStyle}>{formatValue(data?.totalCustomers)}</td>
                <td className={getCellClassName(date, data?.dayOfWeek || '', index)} style={cellTextStyle}>{formatValue(data?.groupUnitPrice)}</td>
                <td className={getCellClassName(date, data?.dayOfWeek || '', index)} style={cellTextStyle}>{formatValue(data?.customerUnitPrice)}</td>
                {/* 人件費 */}
                <td className={getCellClassName(date, data?.dayOfWeek || '', index)} style={cellTextStyle}>{formatDecimal(data?.katougi)}</td>
                <td className={getCellClassName(date, data?.dayOfWeek || '', index)} style={cellTextStyle}>{formatDecimal(data?.ishimori)}</td>
                <td className={getCellClassName(date, data?.dayOfWeek || '', index)} style={cellTextStyle}>{formatDecimal(data?.osawa)}</td>
                <td className={getCellClassName(date, data?.dayOfWeek || '', index)} style={cellTextStyle}>{formatDecimal(data?.washizuka)}</td>
                <td className={getCellClassName(date, data?.dayOfWeek || '', index)} style={cellTextStyle}>{formatDecimal(data?.employeeHours)}</td>
                <td className={getCellClassName(date, data?.dayOfWeek || '', index)} style={cellTextStyle}>{formatDecimal(data?.asHours)}</td>
                <td className={getCellClassName(date, data?.dayOfWeek || '', index)} style={cellTextStyle}>{formatValue(data?.salesPerHour)}</td>
                <td className={getCellClassName(date, data?.dayOfWeek || '', index)} style={cellTextStyle}>{formatValue(data?.laborCost)}</td>
                <td className={getCellClassName(date, data?.dayOfWeek || '', index)} style={cellTextStyle}>{formatPercent(data?.laborCostRate)}</td>
                {/* EDW営業明細 */}
                <td className={getCellClassName(date, data?.dayOfWeek || '', index)} style={cellTextStyle}>{formatValue(data?.lunchSales, data?.is_predicted)}</td>
                <td className={getCellClassName(date, data?.dayOfWeek || '', index)} style={cellTextStyle}>{formatValue(data?.dinnerSales, data?.is_predicted)}</td>
                <td className={getCellClassName(date, data?.dayOfWeek || '', index)} style={cellTextStyle}>{formatValue(data?.lunchCustomers)}</td>
                <td className={getCellClassName(date, data?.dayOfWeek || '', index)} style={cellTextStyle}>{formatValue(data?.dinnerCustomers)}</td>
                <td className={getCellClassName(date, data?.dayOfWeek || '', index)} style={cellTextStyle}>{formatValue(data?.lunchGroups)}</td>
                <td className={getCellClassName(date, data?.dayOfWeek || '', index)} style={cellTextStyle}>{formatValue(data?.dinnerGroups)}</td>
                <td className={getCellClassName(date, data?.dayOfWeek || '', index)} style={cellTextStyle}>{formatValue(data?.edwCustomerUnitPrice)}</td>
                <td className={getCellClassName(date, data?.dayOfWeek || '', index)} style={cellTextStyle}>{formatValue(data?.lunchUnitPrice)}</td>
                <td className={getCellClassName(date, data?.dayOfWeek || '', index)} style={cellTextStyle}>{formatValue(data?.dinnerUnitPrice)}</td>
                {/* OHB */}
                <td className={getCellClassName(date, data?.dayOfWeek || '', index)} style={cellTextStyle}>{formatValue(data?.ohbSales, data?.is_predicted)}</td>
                <td className={getCellClassName(date, data?.dayOfWeek || '', index)} style={cellTextStyle}>{formatValue(data?.ohbCustomers)}</td>
                <td className={getCellClassName(date, data?.dayOfWeek || '', index)} style={cellTextStyle}>{formatValue(data?.ohbGroups)}</td>
                <td className={getCellClassName(date, data?.dayOfWeek || '', index)} style={cellTextStyle}>{formatValue(data?.ohbCustomerUnitPrice)}</td>
                {/* VOID */}
                <td className={getCellClassName(date, data?.dayOfWeek || '', index)} style={cellTextStyle}>{formatValue(data?.voidCount)}</td>
                <td className={getCellClassName(date, data?.dayOfWeek || '', index)} style={cellTextStyle}>{formatValue(data?.voidAmount)}</td>
                <td className={getCellClassName(date, data?.dayOfWeek || '', index)} style={cellTextStyle}>{formatValue(data?.salesDiscrepancy)}</td>
                {/* 生産性 */}
                <td className={getCellClassName(date, data?.dayOfWeek || '', index)} style={cellTextStyle}>{formatDecimal(data?.totalHours)}</td>
                <td className={getCellClassName(date, data?.dayOfWeek || '', index)} style={cellTextStyle}>{formatDecimal(data?.edwBaitHours)}</td>
                <td className={getCellClassName(date, data?.dayOfWeek || '', index)} style={cellTextStyle}>{formatDecimal(data?.ohbBaitHours)}</td>
                <td className={getCellClassName(date, data?.dayOfWeek || '', index)} style={cellTextStyle}>{formatValue(data?.edwProductivity)}</td>
                <td className={getCellClassName(date, data?.dayOfWeek || '', index)} style={cellTextStyle}>{formatValue(data?.ohbProductivity)}</td>
                <td className={getCellClassName(date, data?.dayOfWeek || '', index)} style={cellTextStyle}>{formatValue(data?.totalProductivity)}</td>
                {/* OHB予約 */}
                <td className={getCellClassName(date, data?.dayOfWeek || '', index)} style={cellTextStyle}>{formatValue(data?.reservationCount)}</td>
                <td className={getCellClassName(date, data?.dayOfWeek || '', index)} style={cellTextStyle}>{formatValue(data?.plain)}</td>
                <td className={getCellClassName(date, data?.dayOfWeek || '', index)} style={cellTextStyle}>{formatValue(data?.junsei)}</td>
                <td className={getCellClassName(date, data?.dayOfWeek || '', index)} style={cellTextStyle}>{formatValue(data?.seasonal)}</td>
                {/* アンケート */}
                <td className={getCellClassName(date, data?.dayOfWeek || '', index)} style={cellTextStyle}>{formatValue(data?.surveyCount)}</td>
                <td className={getCellClassName(date, data?.dayOfWeek || '', index)} style={cellTextStyle}>{formatPercent(data?.surveyRate)}</td>
                {/* イベント */}
                <td className={getCellClassName(date, data?.dayOfWeek || '', index)} style={cellTextStyle}>
                  {data?.event || ''}
                </td>
                {/* 操作 */}
                <td className={actionCellClass}>
                  <button
                    onClick={() => onEditClick(date)}
                    className="p-1 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded transition-colors"
                    title="編集"
                  >
                    <Edit2 className="h-3 w-3" />
                  </button>
                </td>
              </tr>
              );
            })}
          </tbody>
          {/* 月間累計行 */}
          {monthlySummary && (
            <tfoot>
              <tr className="bg-gradient-to-r from-blue-100 to-indigo-100 font-bold border-t-2 border-blue-300">
                <td colSpan={2} className="px-2 py-2 text-center text-blue-800 border-r border-gray-300 whitespace-nowrap">
                  月間累計
                </td>
                {/* 目標・前年比 */}
                <td className="px-1 py-2 text-right border-r border-gray-200 text-xs text-gray-900" style={cellTextStyle}>{formatValue(monthlySummary.salesTarget)}</td>
                <td className="px-1 py-2 text-right border-r border-gray-200 text-xs text-gray-900" style={cellTextStyle}>{formatValue(monthlySummary.targetCumulative)}</td>
                <td className="px-1 py-2 text-right border-r border-gray-200 text-xs text-gray-900" style={cellTextStyle}>{formatPercent(monthlySummary.targetRatio)}</td>
                <td className="px-1 py-2 text-right border-r border-gray-200 text-xs text-gray-900" style={cellTextStyle}>{formatPercent(monthlySummary.yearOverYear)}</td>
                <td className="px-1 py-2 text-right border-r border-gray-200 text-xs text-gray-900" style={cellTextStyle}>{formatPercent(monthlySummary.edwYearOverYear)}</td>
                <td className="px-1 py-2 text-right border-r border-gray-300 text-xs text-gray-900" style={cellTextStyle}>{formatPercent(monthlySummary.ohbYearOverYear)}</td>
                {/* 店舗売上 */}
                <td className="px-1 py-2 text-right border-r border-gray-200 text-xs bg-green-50 font-bold text-green-800">{formatValue(monthlySummary.netSales)}</td>
                <td className="px-1 py-2 text-right border-r border-gray-200 text-xs text-gray-900" style={cellTextStyle}>{formatValue(monthlySummary.netSalesCumulative)}</td>
                <td className="px-1 py-2 text-right border-r border-gray-200 text-xs text-gray-900" style={cellTextStyle}>{formatValue(monthlySummary.edwNetSales)}</td>
                <td className="px-1 py-2 text-right border-r border-gray-200 text-xs text-gray-900" style={cellTextStyle}>{formatValue(monthlySummary.edwNetSalesCumulative)}</td>
                <td className="px-1 py-2 text-right border-r border-gray-200 text-xs text-gray-900" style={cellTextStyle}>{formatValue(monthlySummary.ohbNetSales)}</td>
                <td className="px-1 py-2 text-right border-r border-gray-300 text-xs text-gray-900" style={cellTextStyle}>{formatValue(monthlySummary.ohbNetSalesCumulative)}</td>
                {/* 客数・組数 */}
                <td className="px-1 py-2 text-right border-r border-gray-200 text-xs text-gray-900" style={cellTextStyle}>{formatValue(monthlySummary.totalGroups)}</td>
                <td className="px-1 py-2 text-right border-r border-gray-200 text-xs text-gray-900" style={cellTextStyle}>{formatValue(monthlySummary.totalCustomers)}</td>
                <td className="px-1 py-2 text-right border-r border-gray-200 text-xs text-gray-900" style={cellTextStyle}>{formatValue(monthlySummary.groupUnitPrice)}</td>
                <td className="px-1 py-2 text-right border-r border-gray-300 text-xs text-gray-900" style={cellTextStyle}>{formatValue(monthlySummary.customerUnitPrice)}</td>
                {/* 人件費 */}
                <td className="px-1 py-2 text-right border-r border-gray-200 text-xs text-gray-900" style={cellTextStyle}>{formatDecimal(monthlySummary.katougi)}</td>
                <td className="px-1 py-2 text-right border-r border-gray-200 text-xs text-gray-900" style={cellTextStyle}>{formatDecimal(monthlySummary.ishimori)}</td>
                <td className="px-1 py-2 text-right border-r border-gray-200 text-xs text-gray-900" style={cellTextStyle}>{formatDecimal(monthlySummary.osawa)}</td>
                <td className="px-1 py-2 text-right border-r border-gray-200 text-xs text-gray-900" style={cellTextStyle}>{formatDecimal(monthlySummary.washizuka)}</td>
                <td className="px-1 py-2 text-right border-r border-gray-200 text-xs text-gray-900" style={cellTextStyle}>{formatDecimal(monthlySummary.employeeHours)}</td>
                <td className="px-1 py-2 text-right border-r border-gray-200 text-xs text-gray-900" style={cellTextStyle}>{formatDecimal(monthlySummary.asHours)}</td>
                <td className="px-1 py-2 text-right border-r border-gray-200 text-xs text-gray-900" style={cellTextStyle}>{formatValue(monthlySummary.salesPerHour)}</td>
                <td className="px-1 py-2 text-right border-r border-gray-200 text-xs bg-orange-50 font-bold text-orange-800">{formatValue(monthlySummary.laborCost)}</td>
                <td className="px-1 py-2 text-right border-r border-gray-300 text-xs text-gray-900" style={cellTextStyle}>{formatPercent(monthlySummary.laborCostRate)}</td>
                {/* EDW営業明細 */}
                <td className="px-1 py-2 text-right border-r border-gray-200 text-xs text-gray-900" style={cellTextStyle}>{formatValue(monthlySummary.lunchSales)}</td>
                <td className="px-1 py-2 text-right border-r border-gray-200 text-xs text-gray-900" style={cellTextStyle}>{formatValue(monthlySummary.dinnerSales)}</td>
                <td className="px-1 py-2 text-right border-r border-gray-200 text-xs text-gray-900" style={cellTextStyle}>{formatValue(monthlySummary.lunchCustomers)}</td>
                <td className="px-1 py-2 text-right border-r border-gray-200 text-xs text-gray-900" style={cellTextStyle}>{formatValue(monthlySummary.dinnerCustomers)}</td>
                <td className="px-1 py-2 text-right border-r border-gray-200 text-xs text-gray-900" style={cellTextStyle}>{formatValue(monthlySummary.lunchGroups)}</td>
                <td className="px-1 py-2 text-right border-r border-gray-200 text-xs text-gray-900" style={cellTextStyle}>{formatValue(monthlySummary.dinnerGroups)}</td>
                <td className="px-1 py-2 text-right border-r border-gray-200 text-xs text-gray-900" style={cellTextStyle}>{formatValue(monthlySummary.edwCustomerUnitPrice)}</td>
                <td className="px-1 py-2 text-right border-r border-gray-200 text-xs text-gray-900" style={cellTextStyle}>{formatValue(monthlySummary.lunchUnitPrice)}</td>
                <td className="px-1 py-2 text-right border-r border-gray-300 text-xs text-gray-900" style={cellTextStyle}>{formatValue(monthlySummary.dinnerUnitPrice)}</td>
                {/* OHB */}
                <td className="px-1 py-2 text-right border-r border-gray-200 text-xs text-gray-900" style={cellTextStyle}>{formatValue(monthlySummary.ohbSales)}</td>
                <td className="px-1 py-2 text-right border-r border-gray-200 text-xs text-gray-900" style={cellTextStyle}>{formatValue(monthlySummary.ohbCustomers)}</td>
                <td className="px-1 py-2 text-right border-r border-gray-200 text-xs text-gray-900" style={cellTextStyle}>{formatValue(monthlySummary.ohbGroups)}</td>
                <td className="px-1 py-2 text-right border-r border-gray-300 text-xs text-gray-900" style={cellTextStyle}>{formatValue(monthlySummary.ohbCustomerUnitPrice)}</td>
                {/* VOID */}
                <td className="px-1 py-2 text-right border-r border-gray-200 text-xs text-gray-900" style={cellTextStyle}>{formatValue(monthlySummary.voidCount)}</td>
                <td className="px-1 py-2 text-right border-r border-gray-200 text-xs text-gray-900" style={cellTextStyle}>{formatValue(monthlySummary.voidAmount)}</td>
                <td className="px-1 py-2 text-right border-r border-gray-300 text-xs text-gray-900" style={cellTextStyle}>{formatValue(monthlySummary.salesDiscrepancy)}</td>
                {/* 生産性 */}
                <td className="px-1 py-2 text-right border-r border-gray-200 text-xs text-gray-900" style={cellTextStyle}>{formatDecimal(monthlySummary.totalHours)}</td>
                <td className="px-1 py-2 text-right border-r border-gray-200 text-xs text-gray-900" style={cellTextStyle}>{formatDecimal(monthlySummary.edwBaitHours)}</td>
                <td className="px-1 py-2 text-right border-r border-gray-200 text-xs text-gray-900" style={cellTextStyle}>{formatDecimal(monthlySummary.ohbBaitHours)}</td>
                <td className="px-1 py-2 text-right border-r border-gray-200 text-xs text-gray-900" style={cellTextStyle}>{formatValue(monthlySummary.edwProductivity)}</td>
                <td className="px-1 py-2 text-right border-r border-gray-200 text-xs text-gray-900" style={cellTextStyle}>{formatValue(monthlySummary.ohbProductivity)}</td>
                <td className="px-1 py-2 text-right border-r border-gray-300 text-xs text-gray-900" style={cellTextStyle}>{formatValue(monthlySummary.totalProductivity)}</td>
                {/* OHB予約 */}
                <td className="px-1 py-2 text-right border-r border-gray-200 text-xs text-gray-900" style={cellTextStyle}>{formatValue(monthlySummary.reservationCount)}</td>
                <td className="px-1 py-2 text-right border-r border-gray-200 text-xs text-gray-900" style={cellTextStyle}>{formatValue(monthlySummary.plain)}</td>
                <td className="px-1 py-2 text-right border-r border-gray-200 text-xs text-gray-900" style={cellTextStyle}>{formatValue(monthlySummary.junsei)}</td>
                <td className="px-1 py-2 text-right border-r border-gray-300 text-xs text-gray-900" style={cellTextStyle}>{formatValue(monthlySummary.seasonal)}</td>
                {/* アンケート */}
                <td className="px-1 py-2 text-right border-r border-gray-200 text-xs text-gray-900" style={cellTextStyle}>{formatValue(monthlySummary.surveyCount)}</td>
                <td className="px-1 py-2 text-right border-r border-gray-300 text-xs text-gray-900" style={cellTextStyle}>{formatPercent(monthlySummary.surveyRate)}</td>
                {/* イベント */}
                <td className="px-1 py-2 text-center border-r border-gray-300 text-xs text-gray-900 bg-yellow-50"></td>
                {/* 操作 */}
                <td className="px-1 py-2 text-center text-xs text-gray-900" style={cellTextStyle}>-</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
});

SimpleSalesTable.displayName = 'SimpleSalesTable';

export { SimpleSalesTable };
