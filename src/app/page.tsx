'use client';



import React, { useState, useEffect, useRef } from 'react';

import { Card, Title, TabGroup, TabList, Tab, TabPanels, TabPanel } from "@tremor/react";

import { createChart, ColorType, LineWidth } from 'lightweight-charts';

import axios from 'axios';



interface CryptoData {

  time: number;

  open: number;

  high: number;

  low: number;

  close: number;

  volume: number;

}



interface Symbol {

  symbol: string;

  price: string;

  priceChangePercent: string;

}



interface TimeframeOption {

  label: string;

  value: string;

}



interface Timeframes {

  [key: string]: TimeframeOption[];

}



interface Indicator {

  id: string;

  name: string;

  type: 'overlay' | 'separate';

  active: boolean;

  options: {

    period?: number;

    source?: 'close' | 'high' | 'low' | 'hl2' | 'hlc3' | 'ohlc4';

    fastPeriod?: number;

    slowPeriod?: number;

    signalPeriod?: number;

    multiplier?: number;

    maType?: 'SMA' | 'EMA';

  };

  description?: string;

}



interface Strategy {

  id: string;

  name: string;

  active: boolean;

  buyConditions: StrategyCondition[];

  sellConditions: StrategyCondition[];

  notification: {

    email?: boolean;

    browser?: boolean;

    sound?: boolean;

  };

  action?: TradeAction;

}



interface StrategyCondition {

  id: string;

  indicator: string;

  operator: 'crosses_above' | 'crosses_below' | 'greater_than' | 'less_than' | 'equals';

  value?: number | string;

  compareWith?: string;

}



interface TradeAction {

  type: 'buy' | 'sell';

  amount: number;

  stopLoss?: number;

  takeProfit?: number;

}



interface Trade {

  id: string;

  timestamp: Date;

  symbol: string;

  type: 'buy' | 'sell';

  price: number;

  amount: number;

  strategy: string;

  status: 'open' | 'closed' | 'cancelled';

  pnl?: number;

}



// 알림 로그를 위한 인터페이스 추가

interface NotificationLog {

  id: string;

  symbol: string;

  strategy: string;

  message: string;

  timestamp: Date;

  type: 'info' | 'success' | 'warning' | 'error';

}



// 추세선을 위한 인터페이스 추가

interface TrendLine {

  id: string;

  points: { time: number; value: number; }[];

  color: string;

  width: number;

}



export default function Home() {

  const [activeTab, setActiveTab] = useState(0);

  const chartContainerRef = useRef<HTMLDivElement>(null);

  const [selectedTimeframe, setSelectedTimeframe] = useState('1H');

  const [selectedTimeframeCategory, setSelectedTimeframeCategory] = useState('hour');

  const [symbols, setSymbols] = useState<Symbol[]>([]);

  const [selectedSymbol, setSelectedSymbol] = useState('BTCUSDT');

  const [searchTerm, setSearchTerm] = useState('');

  const [isSymbolListOpen, setIsSymbolListOpen] = useState(false);

  const [chartData, setChartData] = useState<CryptoData[]>([]);

  const [indicators, setIndicators] = useState<Indicator[]>([

    {

      id: 'ma20',

      name: 'MA 20',

      type: 'overlay',

      active: false,

      options: { period: 20, maType: 'SMA' },

      description: '단기 추세를 파악하는데 사용되는 20일 이동평균선'

    },

    {

      id: 'ma50',

      name: 'MA 50',

      type: 'overlay',

      active: false,

      options: { period: 50, maType: 'SMA' },

      description: '중기 추세를 파악하는데 사용되는 50일 이동평균선'

    },

    {

      id: 'ma200',

      name: 'MA 200',

      type: 'overlay',

      active: false,

      options: { period: 200, maType: 'SMA' },

      description: '장기 추세를 파악하는데 사용되는 200일 이동평균선'

    },

    {

      id: 'rsi',

      name: 'RSI',

      type: 'separate',

      active: false,

      options: { 

        period: 14,

        source: 'close'

      },

      description: '과매수/과매도 구간을 파악하는 지표 (기본값 14일)'

    },

    {

      id: 'macd',

      name: 'MACD',

      type: 'separate',

      active: false,

      options: {

        fastPeriod: 12,

        slowPeriod: 26,

        signalPeriod: 9

      },

      description: '단기/장기 이동평균의 차이를 통해 추세 전환을 감지'

    },

    {

      id: 'bb',

      name: 'Bollinger Bands',

      type: 'overlay',

      active: false,

      options: {

        period: 20,

        multiplier: 2,

        source: 'close'

      },

      description: '가격 변동성을 기반으로 한 밴드형 지표'

    }

  ]);



  const [strategies, setStrategies] = useState<Strategy[]>([

    {

      id: 'golden_cross',

      name: 'Golden Cross',

      active: false,

      buyConditions: [

        {

          id: 'buy_condition1',

          indicator: 'ma20',

          operator: 'crosses_above',

          compareWith: 'ma50'

        }

      ],

      sellConditions: [

        {

          id: 'sell_condition1',

          indicator: 'ma20',

          operator: 'crosses_below',

          compareWith: 'ma50'

        }

      ],

      notification: {

        browser: true,

        sound: true

      }

    }

  ]);



  const [notifications, setNotifications] = useState<NotificationLog[]>([]);

  const [isLogScreenOpen, setIsLogScreenOpen] = useState(false);

  const [trades, setTrades] = useState<Trade[]>([]);

  const [balance, setBalance] = useState(10000);



  const [trendLines, setTrendLines] = useState<TrendLine[]>([]);

  const [isDrawingTrendLine, setIsDrawingTrendLine] = useState(false);

  const [currentTrendLine, setCurrentTrendLine] = useState<TrendLine | null>(null);

  const [selectedColor, setSelectedColor] = useState('#FFFFFF');

  const [lineWidth, setLineWidth] = useState(1);

  const [isDragging, setIsDragging] = useState(false);

  const [startPoint, setStartPoint] = useState<{ x: number; y: number; time: number; price: number } | null>(null);



  const timeframes: Timeframes = {

    minute: [

      { label: '1m', value: '1m' },

      { label: '3m', value: '3m' },

      { label: '5m', value: '5m' },

      { label: '15m', value: '15m' },

      { label: '30m', value: '30m' },

      { label: '45m', value: '45m' }

    ],

    hour: [

      { label: '1H', value: '1h' },

      { label: '2H', value: '2h' },

      { label: '3H', value: '3h' },

      { label: '4H', value: '4h' }

    ],

    day: [

      { label: '1D', value: '1d' },

      { label: '1W', value: '1w' },

      { label: '1M', value: '1M' },

      { label: '3M', value: '3M' },

      { label: '6M', value: '6M' },

      { label: '1Y', value: '1y' }

    ]

  };



  // 알림 효과음을 위한 Audio 객체 생성

  const alertSound = typeof window !== 'undefined' ? new Audio('/alert.mp3') : null;



  // 알림 권한 요청

  useEffect(() => {

    if (Notification.permission !== 'granted') {

      Notification.requestPermission();

    }

  }, []);



  useEffect(() => {

    const fetchSymbols = async () => {

      try {

        const [tickerResponse, priceResponse] = await Promise.all([

          axios.get('https://api.binance.com/api/v3/ticker/24hr'),

          axios.get('https://api.binance.com/api/v3/ticker/price')

        ]);



        const usdtPairs = tickerResponse.data

          .filter((ticker: any) => ticker.symbol.endsWith('USDT'))

          .map((ticker: any) => ({

            symbol: ticker.symbol,

            price: parseFloat(ticker.lastPrice).toFixed(2),

            priceChangePercent: ticker.priceChangePercent

          }))

          .sort((a: Symbol, b: Symbol) => 

            parseFloat(b.priceChangePercent) - parseFloat(a.priceChangePercent)

          );



        setSymbols(usdtPairs);

      } catch (error) {

        console.error('Failed to fetch symbols:', error);

      }

    };



    fetchSymbols();

    const interval = setInterval(fetchSymbols, 10000); // 10초마다 업데이트



    return () => clearInterval(interval);

  }, []);



  useEffect(() => {

    const fetchChartData = async () => {

      try {

        const response = await axios.get(

          `https://api.binance.com/api/v3/klines`,

          {

            params: {

              symbol: selectedSymbol,

              interval: selectedTimeframe.toLowerCase(),

              limit: 500

            }

          }

        );



        const formattedData: CryptoData[] = response.data.map((candle: any) => ({

          time: candle[0] / 1000,

          open: parseFloat(candle[1]),

          high: parseFloat(candle[2]),

          low: parseFloat(candle[3]),

          close: parseFloat(candle[4]),

          volume: parseFloat(candle[5])

        }));



        setChartData(formattedData);

      } catch (error) {

        console.error('Failed to fetch chart data:', error);

      }

    };



    fetchChartData();

    const interval = setInterval(fetchChartData, 10000); // 10초마다 업데이트



    return () => clearInterval(interval);

  }, [selectedSymbol, selectedTimeframe]);



  useEffect(() => {

    if (!chartContainerRef.current || chartData.length === 0) return;



    const chart = createChart(chartContainerRef.current, {

      layout: {

        background: { color: '#1E1E1E' },

        textColor: '#DDD',

      },

      grid: {

        vertLines: { color: '#2B2B2B' },

        horzLines: { color: '#2B2B2B' },

      },

      width: chartContainerRef.current.clientWidth,

      height: 500,

      timeScale: {

        timeVisible: true,

        secondsVisible: false,

      },

    });



    // 활성화된 전략 제목 표시

    const activeStrategies = strategies.filter(s => s.active);

    if (activeStrategies.length > 0) {

      chart.applyOptions({

        watermark: {

          visible: true,

          fontSize: 14,

          color: 'rgba(255, 255, 255, 0.4)',

          text: activeStrategies.map(s => s.name).join(' | '),

          vertAlign: 'top',

          horzAlign: 'left',

        },

      });

    }



    const candlestickSeries = chart.addCandlestickSeries({

      upColor: '#26a69a',

      downColor: '#ef5350',

      borderVisible: false,

      wickUpColor: '#26a69a',

      wickDownColor: '#ef5350',

    });



    candlestickSeries.setData(chartData.map(item => ({
      time: item.time as any,
      open: item.open,
      high: item.high,
      low: item.low,
      close: item.close
    })));



    // 전략에서 사용되는 지표들 자동 활성화 및 표시

    const strategyIndicators = new Set<string>();

    activeStrategies.forEach(strategy => {

      strategy.buyConditions.forEach(condition => {

        strategyIndicators.add(condition.indicator);

        if (condition.compareWith) {

          strategyIndicators.add(condition.compareWith);

        }

      });

      strategy.sellConditions.forEach(condition => {

        strategyIndicators.add(condition.indicator);

        if (condition.compareWith) {

          strategyIndicators.add(condition.compareWith);

        }

      });

    });



    // 활성화된 지표들 추가 (기존 활성화 + 전략에서 사용)

    indicators.forEach(indicator => {

      if (!indicator.active && !strategyIndicators.has(indicator.id)) return;



      if (indicator.type === 'overlay') {

        const lineSeries = chart.addLineSeries({

          color: indicator.id.includes('ma20') ? '#2962FF' : 

                 indicator.id.includes('ma50') ? '#FF6B6B' : '#FFD700',

          lineWidth: 2,

          // 전략에서 사용되는 지표는 점선으로 표시

          lineStyle: strategyIndicators.has(indicator.id) ? 1 : 0,

        });



        if (indicator.id.includes('ma')) {

          const period = indicator.options?.period || 20;

          const maData = calculateMA(chartData, period);

          lineSeries.setData(maData);

        }

      } else {

        // 별도 패널에 표시되는 지표

        const indicatorChart = chart.addHistogramSeries({

          color: '#26a69a',

          priceFormat: {

            type: 'price',

          },

          priceScaleId: indicator.id

        });



        indicatorChart.priceScale().applyOptions({

          scaleMargins: {

            top: 0.8,

            bottom: 0,

          },

        });



        if (indicator.id === 'rsi') {

          const rsiData = calculateRSI(chartData, indicator.options?.period || 14);

          indicatorChart.setData(rsiData);

        }

      }

    });



    // 볼륨 차트 추가

    const volumeSeries = chart.addHistogramSeries({

      color: '#26a69a',

      priceFormat: {

        type: 'volume',

      },

      priceScaleId: 'volume'

    });



    volumeSeries.priceScale().applyOptions({

      scaleMargins: {

        top: 0.8,

        bottom: 0,

      },

    });



    // 볼륨 데이터 설정

    const volumeData = chartData.map(item => ({

      time: item.time as any,

      value: item.volume,

      color: (item.close - item.open) >= 0 ? '#26a69a' : '#ef5350'

    }));



    volumeSeries.setData(volumeData);



    const handleResize = () => {

      if (chartContainerRef.current) {

        chart.applyOptions({ width: chartContainerRef.current.clientWidth });

      }

    };



    window.addEventListener('resize', handleResize);



    // 마우스가 차트 위로 올라갔을 때 십자선 표시

    chart.applyOptions({

      crosshair: {

        mode: 1,

        vertLine: {

          width: 1,

          color: '#C3BCDB44',

          style: 0,

        },

        horzLine: {

          width: 1,

          color: '#C3BCDB44',

          style: 0,

        },

      },

    });



    // 추세선 그리기 기능 추가

    const handleMouseDown = (param: any) => {
      if (!isDrawingTrendLine) return;
      
      const rect = chartContainerRef.current?.getBoundingClientRect();
      const x = param.clientX - (rect?.left || 0);
      const y = param.clientY - (rect?.top || 0);
      
      const price = candlestickSeries.coordinateToPrice(y) as number;
      const time = chart.timeScale().coordinateToTime(x) as number;
      
      setStartPoint({
        x,
        y,
        time,
        price
      });
      setIsDragging(true);
    };

    const handleMouseMove = (param: any) => {
      if (!isDragging || !startPoint) return;
      
      const rect = chartContainerRef.current?.getBoundingClientRect();
      const x = param.clientX - (rect?.left || 0);
      const y = param.clientY - (rect?.top || 0);
      
      const price = candlestickSeries.coordinateToPrice(y) as number;
      const time = chart.timeScale().coordinateToTime(x) as number;
      
      // 임시 추세선 업데이트
      if (currentTrendLine) {
        chart.removeSeries(currentTrendLine as any);
      }
      
      const tempLine = chart.addLineSeries({
        color: selectedColor,
        lineWidth: lineWidth as LineWidth,
        lastPriceAnimation: 0
      });
      
      // 시작점과 끝점의 시간이 같을 경우 1초 차이를 줌
      const endTime = startPoint.time === time ? time + 1 : time;
      
      const points = [
        { time: startPoint.time as any, value: startPoint.price },
        { time: endTime as any, value: price }
      ].sort((a, b) => (a.time as number) - (b.time as number));
      
      tempLine.setData(points);
      
      setCurrentTrendLine(tempLine as any);
    };

    const handleMouseUp = (param: any) => {
      if (!isDragging || !startPoint) return;
      
      const rect = chartContainerRef.current?.getBoundingClientRect();
      const x = param.clientX - (rect?.left || 0);
      const y = param.clientY - (rect?.top || 0);
      
      const price = candlestickSeries.coordinateToPrice(y) as number;
      const time = chart.timeScale().coordinateToTime(x) as number;
      
      // 시작점과 끝점의 시간이 같을 경우 1초 차이를 줌
      const endTime = startPoint.time === time ? time + 1 : time;
      
      const points = [
        { time: startPoint.time as any, value: startPoint.price },
        { time: endTime as any, value: price }
      ].sort((a, b) => (a.time as number) - (b.time as number));
      
      // 추세선 완성
      const newTrendLine: TrendLine = {
        id: `trendline_${Date.now()}`,
        points,
        color: selectedColor,
        width: lineWidth
      };
      
      setTrendLines(prev => [...prev, newTrendLine]);
      setCurrentTrendLine(null);
      setIsDragging(false);
      setStartPoint(null);
    };

    chartContainerRef.current.addEventListener('mousedown', handleMouseDown);
    chartContainerRef.current.addEventListener('mousemove', handleMouseMove);
    chartContainerRef.current.addEventListener('mouseup', handleMouseUp);
    chartContainerRef.current.addEventListener('mouseleave', () => {
      setIsDragging(false);
      setStartPoint(null);
      if (currentTrendLine) {
        chart.removeSeries(currentTrendLine as any);
        setCurrentTrendLine(null);
      }
    });

    // 기존 추세선 표시

    trendLines.forEach(line => {

      if (line.points.length === 2) {

        const lineSeries = chart.addLineSeries({

          color: line.color,

          lineWidth: line.width as LineWidth,

          lastPriceAnimation: 0

        });

        lineSeries.setData(line.points.map(point => ({
          time: point.time as any,
          value: point.value
        })));

      }

    });



    return () => {

      window.removeEventListener('resize', handleResize);

      if (chartContainerRef.current) {
        chartContainerRef.current.removeEventListener('mousedown', handleMouseDown);
        chartContainerRef.current.removeEventListener('mousemove', handleMouseMove);
        chartContainerRef.current.removeEventListener('mouseup', handleMouseUp);
      }

      chart.remove();

    };

  }, [chartData, indicators, strategies, trendLines, isDrawingTrendLine, isDragging, startPoint, selectedColor, lineWidth]);



  // 전략 활성화/비활성화 시 관련 지표 자동 업데이트

  useEffect(() => {

    const strategyIndicators = new Set<string>();

    strategies.filter(s => s.active).forEach(strategy => {

      strategy.buyConditions.forEach(condition => {

        strategyIndicators.add(condition.indicator);

        if (condition.compareWith) {

          strategyIndicators.add(condition.compareWith);

        }

      });

      strategy.sellConditions.forEach(condition => {

        strategyIndicators.add(condition.indicator);

        if (condition.compareWith) {

          strategyIndicators.add(condition.compareWith);

        }

      });

    });



    setIndicators(prev => prev.map(indicator => ({

      ...indicator,

      active: indicator.active || strategyIndicators.has(indicator.id)

    })));

  }, [strategies]);



  const getKlineInterval = (timeframe: string) => {

    const intervals: { [key: string]: string } = {

      '1H': '1h',

      '4H': '4h',

      '1D': '1d',

      '1W': '1w',

      '1M': '1M'

    };

    return intervals[timeframe] || '1d';

  };



  const filteredSymbols = symbols.filter(symbol =>

    symbol.symbol.toLowerCase().includes(searchTerm.toLowerCase())

  );



  const calculateMA = (data: CryptoData[], period: number) => {
    return data.map((item, index) => {
      const sum = data.slice(Math.max(0, index - period + 1), index + 1)
        .reduce((acc, curr) => acc + curr.close, 0);
      const value = index < period - 1 ? data[index].close : sum / period;
      return {
        time: item.time as any,
        value: value
      };
    });
  };

  const calculateRSI = (data: CryptoData[], period: number) => {
    let gains = [], losses = [];
    
    // 가격 변화 계산
    for (let i = 1; i < data.length; i++) {
      const change = data[i].close - data[i - 1].close;
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? -change : 0);
    }

    // RSI 계산
    return data.map((item, index) => {
      if (index < period) return { 
        time: item.time as any, 
        value: 50  // 초기값을 50으로 설정
      };
      
      const avgGain = gains.slice(index - period, index).reduce((a, b) => a + b) / period;
      const avgLoss = losses.slice(index - period, index).reduce((a, b) => a + b) / period;
      
      const rs = avgGain / avgLoss;
      const rsi = 100 - (100 / (1 + rs));
      
      return {
        time: item.time as any,
        value: rsi
      };
    });
  };

  const IndicatorSettings = ({ indicator, onUpdate }: { 
    indicator: Indicator; 
    onUpdate: (id: string, options: any) => void;
  }) => {
    return (
      <div className="mt-2 p-4 bg-[#2B2B2B] rounded">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">{indicator.name} 설정</h3>
          <p className="text-sm text-gray-400">{indicator.description}</p>
        </div>
        <div className="space-y-4">
          {indicator.options.period !== undefined && (
            <div>
              <label className="block text-sm text-gray-400 mb-1">기간</label>
              <input
                type="number"
                value={indicator.options.period}
                onChange={(e) => onUpdate(indicator.id, { 
                  ...indicator.options, 
                  period: parseInt(e.target.value) 
                })}
                className="w-full px-3 py-2 bg-[#3B3B3B] rounded"
              />
            </div>
          )}
          
          {indicator.options.maType && (
            <div>
              <label className="block text-sm text-gray-400 mb-1">평균 타입</label>
              <select
                value={indicator.options.maType}
                onChange={(e) => onUpdate(indicator.id, {
                  ...indicator.options,
                  maType: e.target.value
                })}
                className="w-full px-3 py-2 bg-[#3B3B3B] rounded"
              >
                <option value="SMA">SMA (단순 이동평균)</option>
                <option value="EMA">EMA (지수 이동평균)</option>
              </select>
            </div>
          )}

          {indicator.id === 'macd' && (
            <>
              <div>
                <label className="block text-sm text-gray-400 mb-1">빠른 기간</label>
                <input
                  type="number"
                  value={indicator.options.fastPeriod}
                  onChange={(e) => onUpdate(indicator.id, {
                    ...indicator.options,
                    fastPeriod: parseInt(e.target.value)
                  })}
                  className="w-full px-3 py-2 bg-[#3B3B3B] rounded"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">느린 기간</label>
                <input
                  type="number"
                  value={indicator.options.slowPeriod}
                  onChange={(e) => onUpdate(indicator.id, {
                    ...indicator.options,
                    slowPeriod: parseInt(e.target.value)
                  })}
                  className="w-full px-3 py-2 bg-[#3B3B3B] rounded"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">시그널 기간</label>
                <input
                  type="number"
                  value={indicator.options.signalPeriod}
                  onChange={(e) => onUpdate(indicator.id, {
                    ...indicator.options,
                    signalPeriod: parseInt(e.target.value)
                  })}
                  className="w-full px-3 py-2 bg-[#3B3B3B] rounded"
                />
              </div>
            </>
          )}

          {indicator.id === 'bb' && (
            <div>
              <label className="block text-sm text-gray-400 mb-1">표준편차 승수</label>
              <input
                type="number"
                step="0.1"
                value={indicator.options.multiplier}
                onChange={(e) => onUpdate(indicator.id, {
                  ...indicator.options,
                  multiplier: parseFloat(e.target.value)
                })}
                className="w-full px-3 py-2 bg-[#3B3B3B] rounded"
              />
            </div>
          )}

          {indicator.options.source && (
            <div>
              <label className="block text-sm text-gray-400 mb-1">데이터 소스</label>
              <select
                value={indicator.options.source}
                onChange={(e) => onUpdate(indicator.id, {
                  ...indicator.options,
                  source: e.target.value
                })}
                className="w-full px-3 py-2 bg-[#3B3B3B] rounded"
              >
                <option value="close">종가</option>
                <option value="high">고가</option>
                <option value="low">저가</option>
                <option value="hl2">(고가+저가)/2</option>
                <option value="hlc3">(고가+저가+종가)/3</option>
                <option value="ohlc4">(시가+고가+저가+종가)/4</option>
              </select>
            </div>
          )}
        </div>
      </div>
    );
  };

  const checkStrategyConditions = (strategy: Strategy, currentData: CryptoData, previousData: CryptoData) => {
    // 매수 조건 체크
    const buySignal = strategy.buyConditions.every(condition => {
      const currentValue = calculateIndicatorValue(condition.indicator, currentData);
      const previousValue = calculateIndicatorValue(condition.indicator, previousData);
      
      if (condition.compareWith) {
        const compareCurrentValue = calculateIndicatorValue(condition.compareWith, currentData);
        const comparePreviousValue = calculateIndicatorValue(condition.compareWith, previousData);
        
        switch (condition.operator) {
          case 'crosses_above':
            return previousValue < comparePreviousValue && currentValue > compareCurrentValue;
          case 'crosses_below':
            return previousValue > comparePreviousValue && currentValue < compareCurrentValue;
          default:
            return false;
        }
      } else {
        const targetValue = parseFloat(condition.value as string);
        switch (condition.operator) {
          case 'greater_than':
            return currentValue > targetValue;
          case 'less_than':
            return currentValue < targetValue;
          case 'equals':
            return Math.abs(currentValue - targetValue) < 0.0001;
          default:
            return false;
        }
      }
    });

    // 매도 조건 체크
    const sellSignal = strategy.sellConditions.every(condition => {
      const currentValue = calculateIndicatorValue(condition.indicator, currentData);
      const previousValue = calculateIndicatorValue(condition.indicator, previousData);
      
      if (condition.compareWith) {
        const compareCurrentValue = calculateIndicatorValue(condition.compareWith, currentData);
        const comparePreviousValue = calculateIndicatorValue(condition.compareWith, previousData);
        
        switch (condition.operator) {
          case 'crosses_above':
            return previousValue < comparePreviousValue && currentValue > compareCurrentValue;
          case 'crosses_below':
            return previousValue > comparePreviousValue && currentValue < compareCurrentValue;
          default:
            return false;
        }
      } else {
        const targetValue = parseFloat(condition.value as string);
        switch (condition.operator) {
          case 'greater_than':
            return currentValue > targetValue;
          case 'less_than':
            return currentValue < targetValue;
          case 'equals':
            return Math.abs(currentValue - targetValue) < 0.0001;
          default:
            return false;
        }
      }
    });

    return {
      shouldBuy: buySignal,
      shouldSell: sellSignal
    };
  };

  const calculateIndicatorValue = (indicatorId: string, data: CryptoData) => {
    const indicator = indicators.find(ind => ind.id === indicatorId);
    if (!indicator) return 0;

    switch (indicatorId) {
      case 'ma20':
      case 'ma50':
      case 'ma200':
        const period = indicator.options.period || 20;
        return calculateMA([data], period)[0].value;
      case 'rsi':
        const rsiPeriod = indicator.options.period || 14;
        return calculateRSI([data], rsiPeriod)[0].value;
      default:
        return 0;
    }
  };



  const StrategyAlert = ({ strategy, onUpdate, onDelete }: {

    strategy: Strategy;

    onUpdate: (strategy: Strategy) => void;

    onDelete: (id: string) => void;

  }) => {

    return (

      <div className="p-4 bg-[#2B2B2B] rounded mb-4">

        <div className="flex justify-between items-center mb-4">

          <div>

            <input

              type="text"

              value={strategy.name}

              onChange={(e) => onUpdate({ ...strategy, name: e.target.value })}

              className="bg-[#3B3B3B] px-3 py-1 rounded"

            />

            <button

              className={`ml-2 px-3 py-1 rounded ${

                strategy.active ? 'bg-green-500' : 'bg-gray-500'

              }`}

              onClick={() => onUpdate({ ...strategy, active: !strategy.active })}

            >

              {strategy.active ? '활성' : '비활성'}

            </button>

          </div>

          <button

            className="text-red-500 hover:text-red-400"

            onClick={() => onDelete(strategy.id)}

          >

            삭제

          </button>

        </div>



        <div className="space-y-6">

          {/* 매수 조건 섹션 */}

          <div>

            <div className="flex justify-between items-center mb-3">

              <h4 className="text-green-500 font-semibold">매수 조건</h4>

              <button

                onClick={() => onUpdate({

                  ...strategy,

                  buyConditions: [...strategy.buyConditions, {

                    id: `buy_${Date.now()}`,

                    indicator: 'ma20',

                    operator: 'crosses_above',

                    compareWith: 'ma50'

                  }]

                })}

                className="text-xs bg-green-500 hover:bg-green-600 px-2 py-1 rounded"

              >

                조건 추가

              </button>

            </div>

            <div className="space-y-3">

              {strategy.buyConditions.map((condition) => (

                <StrategyConditionSettings

                  key={condition.id}

                  condition={condition}

                  type="buy"

                  onUpdate={(updatedCondition: StrategyCondition) => {

                    onUpdate({

                      ...strategy,

                      buyConditions: strategy.buyConditions.map(c =>

                        c.id === condition.id ? updatedCondition : c

                      )

                    });

                  }}

                  onDelete={() => {

                    onUpdate({

                      ...strategy,

                      buyConditions: strategy.buyConditions.filter(c => c.id !== condition.id)

                    });

                  }}

                />

              ))}

              {strategy.buyConditions.length > 0 && (

                <div className="text-xs text-gray-400 mt-2">

                  💡 모든 조건이 충족되어야 매수 신호가 발생합니다.

                </div>

              )}

            </div>

          </div>



          {/* 매도 조건 섹션 */}

          <div>

            <div className="flex justify-between items-center mb-3">

              <h4 className="text-red-500 font-semibold">매도 조건</h4>

              <button

                onClick={() => onUpdate({

                  ...strategy,

                  sellConditions: [...strategy.sellConditions, {

                    id: `sell_${Date.now()}`,

                    indicator: 'ma20',

                    operator: 'crosses_below',

                    compareWith: 'ma50'

                  }]

                })}

                className="text-xs bg-red-500 hover:bg-red-600 px-2 py-1 rounded"

              >

                조건 추가

              </button>

            </div>

            <div className="space-y-3">

              {strategy.sellConditions.map((condition) => (

                <StrategyConditionSettings

                  key={condition.id}

                  condition={condition}

                  type="sell"

                  onUpdate={(updatedCondition: StrategyCondition) => {

                    onUpdate({

                      ...strategy,

                      sellConditions: strategy.sellConditions.map(c =>

                        c.id === condition.id ? updatedCondition : c

                      )

                    });

                  }}

                  onDelete={() => {

                    onUpdate({

                      ...strategy,

                      sellConditions: strategy.sellConditions.filter(c => c.id !== condition.id)

                    });

                  }}

                />

              ))}

              {strategy.sellConditions.length > 0 && (

                <div className="text-xs text-gray-400 mt-2">

                  💡 모든 조건이 충족되어야 매도 신호가 발생합니다.

                </div>

              )}

            </div>

          </div>

        </div>



        <div className="mt-4">

          <h4 className="mb-2 text-sm text-gray-400">알림 설정</h4>

          <div className="flex gap-4">

            <label className="flex items-center">

              <input

                type="checkbox"

                checked={strategy.notification.browser}

                onChange={(e) => onUpdate({

                  ...strategy,

                  notification: { ...strategy.notification, browser: e.target.checked }

                })}

                className="mr-2"

              />

              브라우저 알림

            </label>

            <label className="flex items-center">

              <input

                type="checkbox"

                checked={strategy.notification.sound}

                onChange={(e) => onUpdate({

                  ...strategy,

                  notification: { ...strategy.notification, sound: e.target.checked }

                })}

                className="mr-2"

              />

              소리 알림

            </label>

          </div>

        </div>



        <div className="mt-4 border-t border-[#3B3B3B] pt-4">

          <h4 className="mb-2 text-sm text-gray-400">거래 설정</h4>

          <div className="space-y-4">

            <div className="flex gap-4">

              <select

                value={strategy.action?.type || 'none'}

                onChange={(e) => {

                  const type = e.target.value as 'buy' | 'sell' | 'none';

                  onUpdate({

                    ...strategy,

                    action: type === 'none' ? undefined : {

                      type,

                      amount: 100,

                      stopLoss: 2,

                      takeProfit: 4

                    }

                  });

                }}

                className="bg-[#4B4B4B] rounded px-2 py-1"

              >

                <option value="none">거래 없음</option>

                <option value="buy">매수</option>

                <option value="sell">매도</option>

              </select>

            </div>



            {strategy.action && (

              <>

                <div>

                  <label className="block text-sm text-gray-400 mb-1">거래 비율 (%)</label>

                  <input

                    type="number"

                    min="1"

                    max="100"

                    value={strategy.action.amount}

                    onChange={(e) => onUpdate({

                      ...strategy,

                      action: {

                        ...strategy.action,

                        type: (strategy.action?.type || 'buy') as 'buy' | 'sell',

                        amount: parseFloat(e.target.value)

                      }

                    })}

                    className="w-full px-3 py-2 bg-[#3B3B3B] rounded"

                  />

                </div>

                <div>

                  <label className="block text-sm text-gray-400 mb-1">손절가 (%)</label>

                  <input

                    type="number"

                    step="0.1"

                    value={strategy.action.stopLoss}

                    onChange={(e) => onUpdate({

                      ...strategy,

                      action: {

                        ...strategy.action,
                        type: (strategy.action?.type || 'buy') as 'buy' | 'sell',
                        stopLoss: parseFloat(e.target.value)

                      }

                    })}

                    className="w-full px-3 py-2 bg-[#3B3B3B] rounded"

                  />

                </div>

                <div>

                  <label className="block text-sm text-gray-400 mb-1">익절가 (%)</label>

                  <input

                    type="number"

                    step="0.1"

                    value={strategy.action.takeProfit}

                    onChange={(e) => onUpdate({

                      ...strategy,

                      action: {

                        ...strategy.action,

                        type: (strategy.action?.type || 'buy') as 'buy' | 'sell',

                        takeProfit: parseFloat(e.target.value)

                      }

                    })}

                    className="w-full px-3 py-2 bg-[#3B3B3B] rounded"

                  />

                </div>

              </>

            )}

          </div>

        </div>

      </div>

    );

  };



  // 알림 로그 컴포넌트

  const NotificationPanel = () => {

    return (

      <div className="fixed right-4 top-4 w-80 max-h-[calc(100vh-2rem)] overflow-y-auto z-50">

        <div className="flex justify-between items-center mb-2 bg-[#2B2B2B] p-2 rounded">

          <span className="text-sm font-bold">최근 알림</span>

          <button

            onClick={() => setIsLogScreenOpen(true)}

            className="text-xs text-blue-400 hover:text-blue-300"

          >

            전체보기

          </button>

        </div>

        {/* 기존 알림 목록 유지 */}

      </div>

    );

  };



  // 알림 추가 함수

  const addNotification = (notification: Omit<NotificationLog, 'id' | 'timestamp'>) => {

    setNotifications(prev => [

      {

        ...notification,

        id: `notification_${Date.now()}`,

        timestamp: new Date()

      },

      ...prev.slice(0, 49) // 최대 50개까지만 유지

    ]);

  };



  // 거래 실행 함수

  const executeTrade = async (strategy: Strategy, currentPrice: number) => {

    if (!strategy.action) return;



    const tradeAmount = (balance * (strategy.action.amount / 100));

    const quantity = tradeAmount / currentPrice;



    try {

      // 실제 거래소 API 연동 시 여기에 구현

      // 현재는 시뮬레이션으로만 동작

      const trade: Trade = {

        id: `trade_${Date.now()}`,

        timestamp: new Date(),

        symbol: selectedSymbol,

        type: strategy.action.type,

        price: currentPrice,

        amount: quantity,

        strategy: strategy.name,

        status: 'open'

      };



      setTrades(prev => [trade, ...prev]);

      

      // 잔고 업데이트

      if (strategy.action.type === 'buy') {

        setBalance(prev => prev - tradeAmount);

      } else {

        setBalance(prev => prev + tradeAmount);

      }



      // 알림 추가

      addNotification({

        symbol: selectedSymbol,

        strategy: strategy.name,

        message: `${strategy.action.type === 'buy' ? '매수' : '매도'} 주문 실행: ${quantity.toFixed(4)} ${selectedSymbol} @ $${currentPrice}`,

        type: 'success'

      });

    } catch (error) {

      console.error('Trade execution failed:', error);

      addNotification({

        symbol: selectedSymbol,

        strategy: strategy.name,

        message: '주문 실행 실패',

        type: 'error'

      });

    }

  };



  // 전략 조건 체크

  useEffect(() => {

    if (chartData.length < 2) return;



    const currentData = chartData[chartData.length - 1];

    const previousData = chartData[chartData.length - 2];



    strategies.forEach(strategy => {

      if (!strategy.active) return;



      const { shouldBuy, shouldSell } = checkStrategyConditions(strategy, currentData, previousData);



      if (shouldBuy) {

        // 매수 알림 및 실행

        addNotification({

          symbol: selectedSymbol,

          strategy: strategy.name,

          message: `매수 조건 충족`,

          type: 'success'

        });



        if (strategy.action?.type === 'buy') {

          executeTrade(strategy, currentData.close);

        }

      }



      if (shouldSell) {

        // 매도 알림 및 실행

        addNotification({

          symbol: selectedSymbol,

          strategy: strategy.name,

          message: `매도 조건 충족`,

          type: 'warning'

        });



        if (strategy.action?.type === 'sell') {

          executeTrade(strategy, currentData.close);

        }

      }

    });

  }, [chartData, strategies]);



  const StrategyConditionSettings = ({
    condition,
    onUpdate,
    onDelete,
    type
  }: {
    condition: StrategyCondition;
    onUpdate: (condition: StrategyCondition) => void;
    onDelete: () => void;
    type: 'buy' | 'sell';
  }) => {
    return (
      <div className={`p-4 bg-[#3B3B3B] rounded border-l-4 ${
        type === 'buy' ? 'border-green-500' : 'border-red-500'
      }`}>
        <div className="flex justify-between items-center mb-4">
          <span className="text-sm font-semibold">
            {type === 'buy' ? '매수' : '매도'} 조건
          </span>
          <button
            onClick={onDelete}
            className="text-red-400 hover:text-red-300 text-sm"
          >
            삭제
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">지표 선택</label>
            <select
              value={condition.indicator}
              onChange={(e) => onUpdate({ ...condition, indicator: e.target.value })}
              className="w-full px-3 py-2 bg-[#2B2B2B] rounded"
            >
              <option value="ma20">MA 20</option>
              <option value="ma50">MA 50</option>
              <option value="ma200">MA 200</option>
              <option value="rsi">RSI</option>
              <option value="macd">MACD</option>
              <option value="bb">Bollinger Bands</option>
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">조건</label>
            <select
              value={condition.operator}
              onChange={(e) => onUpdate({
                ...condition,
                operator: e.target.value as any,
                compareWith: e.target.value.includes('crosses') ? 'ma50' : undefined,
                value: e.target.value.includes('crosses') ? undefined : '0'
              })}
              className="w-full px-3 py-2 bg-[#2B2B2B] rounded"
            >
              <option value="crosses_above">이상 교차</option>
              <option value="crosses_below">이하 교차</option>
              <option value="greater_than">초과</option>
              <option value="less_than">미만</option>
              <option value="equals">같음</option>
            </select>
          </div>

          {condition.operator.includes('crosses') ? (
            <div>
              <label className="block text-sm text-gray-400 mb-1">비교 지표</label>
              <select
                value={condition.compareWith}
                onChange={(e) => onUpdate({ ...condition, compareWith: e.target.value })}
                className="w-full px-3 py-2 bg-[#2B2B2B] rounded"
              >
                <option value="ma20">MA 20</option>
                <option value="ma50">MA 50</option>
                <option value="ma200">MA 200</option>
              </select>
            </div>
          ) : (
            <div>
              <label className="block text-sm text-gray-400 mb-1">기준값</label>
              <input
                type="number"
                step="0.1"
                value={condition.value}
                onChange={(e) => onUpdate({ ...condition, value: e.target.value })}
                className="w-full px-3 py-2 bg-[#2B2B2B] rounded"
              />
            </div>
          )}
        </div>
      </div>
    );
  };



  // 추세선 관리 컴포넌트

  const TrendLineControls = () => {

    return (

      <div className="absolute top-4 left-4 bg-[#2B2B2B] p-4 rounded shadow-lg z-10">

        <div className="flex items-center gap-4 mb-4">

          <button

            className={`px-3 py-1 rounded ${

              isDrawingTrendLine ? 'bg-blue-500' : 'bg-[#3B3B3B]'

            }`}

            onClick={() => setIsDrawingTrendLine(!isDrawingTrendLine)}

          >

            {isDrawingTrendLine ? '그리기 취소' : '추세선 그리기'}

          </button>

          <input

            type="color"

            value={selectedColor}

            onChange={(e) => setSelectedColor(e.target.value)}

            className="w-8 h-8 rounded cursor-pointer"

          />

          <select

            value={lineWidth}

            onChange={(e) => setLineWidth(Number(e.target.value))}

            className="bg-[#3B3B3B] px-2 py-1 rounded"

          >

            <option value="1">얇게</option>

            <option value="2">보통</option>

            <option value="3">굵게</option>

          </select>

        </div>

        

        {trendLines.length > 0 && (

          <div className="space-y-2">

            <h4 className="text-sm font-semibold mb-2">추세선 목록</h4>

            {trendLines.map(line => (

              <div

                key={line.id}

                className="flex items-center justify-between bg-[#3B3B3B] p-2 rounded"

              >

                <div className="flex items-center gap-2">

                  <div

                    className="w-4 h-4 rounded"

                    style={{ backgroundColor: line.color }}

                  />

                  <span className="text-sm">

                    추세선 #{line.id.split('_')[1].slice(-4)}

                  </span>

                </div>

                <button

                  className="text-red-400 hover:text-red-300 text-sm"

                  onClick={() => {

                    setTrendLines(prev => prev.filter(l => l.id !== line.id));

                  }}

                >

                  삭제

                </button>

              </div>

            ))}

          </div>

        )}

      </div>

    );

  };



  const NotificationLogScreen = ({ 
    notifications, 
    onClose,
    onClear 
  }: { 
    notifications: NotificationLog[];
    onClose: () => void;
    onClear: () => void;
  }) => {
    const [filter, setFilter] = useState('all');
    const [sortBy, setSortBy] = useState('newest');
    const [searchTerm, setSearchTerm] = useState('');

    const filteredNotifications = notifications
      .filter(notification => {
        if (filter !== 'all' && notification.type !== filter) return false;
        if (searchTerm) {
          const searchLower = searchTerm.toLowerCase();
          return notification.symbol.toLowerCase().includes(searchLower) ||
                 notification.strategy.toLowerCase().includes(searchLower) ||
                 notification.message.toLowerCase().includes(searchLower);
        }
        return true;
      })
      .sort((a, b) => {
        const timeA = new Date(a.timestamp).getTime();
        const timeB = new Date(b.timestamp).getTime();
        return sortBy === 'newest' ? timeB - timeA : timeA - timeB;
      });

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-[#1E1E1E] w-[800px] max-h-[80vh] rounded-lg shadow-xl">
          <div className="p-4 border-b border-[#2B2B2B] flex justify-between items-center">
            <h2 className="text-xl font-bold">알림 로그</h2>
            <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
          </div>
          <div className="p-4 border-b border-[#2B2B2B] space-y-4">
            <div className="flex gap-4 items-center">
              <input
                type="text"
                placeholder="검색..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1 px-3 py-2 bg-[#2B2B2B] rounded"
              />
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="px-3 py-2 bg-[#2B2B2B] rounded"
              >
                <option value="all">모든 알림</option>
                <option value="success">성공</option>
                <option value="warning">경고</option>
                <option value="error">오류</option>
              </select>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-2 bg-[#2B2B2B] rounded"
              >
                <option value="newest">최신순</option>
                <option value="oldest">오래된순</option>
              </select>
              <button
                onClick={onClear}
                className="px-4 py-2 bg-red-500 hover:bg-red-600 rounded"
              >
                전체 삭제
              </button>
            </div>
            <div className="text-sm text-gray-400">
              총 {filteredNotifications.length}개의 알림
            </div>
          </div>
          <div className="overflow-y-auto max-h-[calc(80vh-200px)] p-4">
            <div className="space-y-2">
              {filteredNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 rounded bg-[#2B2B2B] border-l-4 ${
                    notification.type === 'success' ? 'border-green-500' :
                    notification.type === 'warning' ? 'border-yellow-500' :
                    notification.type === 'error' ? 'border-red-500' :
                    'border-blue-500'
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="font-bold">{notification.symbol}</span>
                      <span className="mx-2">•</span>
                      <span className="text-gray-400">{notification.strategy}</span>
                    </div>
                    <span className="text-xs text-gray-400">
                      {new Date(notification.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-sm">{notification.message}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };



  return (

    <main className="p-4 bg-[#1E1E1E] min-h-screen text-white">

      <NotificationPanel />

      {isLogScreenOpen && (

        <NotificationLogScreen

          notifications={notifications}

          onClose={() => setIsLogScreenOpen(false)}

          onClear={() => setNotifications([])}

        />

      )}

      <div className="max-w-[1800px] mx-auto">

        {/* 심볼 선택 섹션 */}

        <div className="mb-6 relative">

          <div className="flex gap-4 items-center">

            <div className="relative w-80">

              <input

                type="text"

                className="w-full px-4 py-2 bg-[#2B2B2B] rounded border border-[#3B3B3B] focus:outline-none focus:border-blue-500"

                placeholder="코인 검색..."

                value={searchTerm}

                onChange={(e) => {

                  setSearchTerm(e.target.value);

                  setIsSymbolListOpen(true);

                }}

                onClick={() => setIsSymbolListOpen(true)}

              />

              {isSymbolListOpen && (

                <div className="absolute w-full mt-1 max-h-96 overflow-y-auto bg-[#2B2B2B] border border-[#3B3B3B] rounded shadow-lg z-50">

                  {filteredSymbols.map((symbol) => (

                    <div

                      key={symbol.symbol}

                      className="px-4 py-2 hover:bg-[#3B3B3B] cursor-pointer flex justify-between items-center"

                      onClick={() => {

                        setSelectedSymbol(symbol.symbol);

                        setIsSymbolListOpen(false);

                        setSearchTerm('');

                      }}

                    >

                      <span>{symbol.symbol.replace('USDT', '')}</span>

                      <div className="text-right">

                        <div>${symbol.price}</div>

                        <div className={parseFloat(symbol.priceChangePercent) >= 0 ? 'text-green-500' : 'text-red-500'}>

                          {parseFloat(symbol.priceChangePercent).toFixed(2)}%

                        </div>

                      </div>

                    </div>

                  ))}

                </div>

              )}

            </div>

            <div>

              <h1 className="text-2xl font-bold">{selectedSymbol}</h1>

              {symbols.find(s => s.symbol === selectedSymbol) && (

                <p className={`text-xl ${parseFloat(symbols.find(s => s.symbol === selectedSymbol)!.priceChangePercent) >= 0 ? 'text-green-500' : 'text-red-500'}`}>

                  ${symbols.find(s => s.symbol === selectedSymbol)!.price} 

                  ({parseFloat(symbols.find(s => s.symbol === selectedSymbol)!.priceChangePercent).toFixed(2)}%)

                </p>

              )}

            </div>

          </div>

        </div>



        {/* 기존 코드 유지 */}

        <div className="flex flex-col gap-2 mb-4">

          <div className="flex justify-end gap-2">

            {Object.keys(timeframes).map((category) => (

              <button

                key={category}

                className={`px-3 py-1 rounded ${

                  selectedTimeframeCategory === category

                    ? 'bg-blue-600'

                    : 'bg-[#2B2B2B] hover:bg-[#3B3B3B]'

                }`}

                onClick={() => {

                  setSelectedTimeframeCategory(category);

                  setSelectedTimeframe(timeframes[category][0].value);

                }}

              >

                {category.charAt(0).toUpperCase() + category.slice(1)}

              </button>

            ))}

          </div>

          <div className="flex justify-end gap-2">

            {timeframes[selectedTimeframeCategory].map((timeframe) => (

              <button

                key={timeframe.value}

                className={`px-3 py-1 rounded ${

                  selectedTimeframe === timeframe.value

                    ? 'bg-blue-500'

                    : 'bg-[#2B2B2B] hover:bg-[#3B3B3B]'

                }`}

                onClick={() => setSelectedTimeframe(timeframe.value)}

              >

                {timeframe.label}

              </button>

            ))}

          </div>

        </div>



        {/* 차트 섹션 */}

        <Card className="bg-[#1E1E1E] border-[#2B2B2B] relative">

          <TrendLineControls />

          <div ref={chartContainerRef} />

        </Card>



        {/* 하단 정보 패널 */}

        <div className="mt-4">

          <TabGroup index={activeTab} onIndexChange={setActiveTab}>

            <TabList className="border-b border-[#2B2B2B]">

              <Tab>차트 정보</Tab>

              <Tab>거래량</Tab>

              <Tab>지표 설정</Tab>

              <Tab>전략 알림</Tab>

              <Tab>거래 내역</Tab>

            </TabList>

            <TabPanels>

              <TabPanel>

                <div className="grid grid-cols-4 gap-4 mt-4">

                  <div className="bg-[#2B2B2B] p-4 rounded">

                    <p className="text-gray-400">24시간 고가</p>

                    <p className="text-xl">$47,123.00</p>

                  </div>

                  <div className="bg-[#2B2B2B] p-4 rounded">

                    <p className="text-gray-400">24시간 저가</p>

                    <p className="text-xl">$45,678.00</p>

                  </div>

                  <div className="bg-[#2B2B2B] p-4 rounded">

                    <p className="text-gray-400">24시간 거래량</p>

                    <p className="text-xl">$1.2B</p>

                  </div>

                  <div className="bg-[#2B2B2B] p-4 rounded">

                    <p className="text-gray-400">시가총액</p>

                    <p className="text-xl">$892.5B</p>

                  </div>

                </div>

              </TabPanel>

              <TabPanel>

                <div className="mt-4">거래량 정보가 여기에 표시됩니다.</div>

              </TabPanel>

              <TabPanel>

                <div className="grid grid-cols-3 gap-4 mt-4">

                  {indicators.map(indicator => (

                    <div key={indicator.id}>

                      <div className="flex items-center justify-between p-4 bg-[#2B2B2B] rounded">

                        <span>{indicator.name}</span>

                        <button

                          className={`px-3 py-1 rounded ${

                            indicator.active

                              ? 'bg-blue-500'

                              : 'bg-[#3B3B3B] hover:bg-[#4B4B4B]'

                          }`}

                          onClick={() => {

                            setIndicators(prev =>

                              prev.map(ind =>

                                ind.id === indicator.id

                                  ? { ...ind, active: !ind.active }

                                  : ind

                              )

                            );

                          }}

                        >

                          {indicator.active ? '제거' : '추가'}

                        </button>

                      </div>

                      {indicator.active && (

                        <IndicatorSettings

                          indicator={indicator}

                          onUpdate={(id, options) => {

                            setIndicators(prev =>

                              prev.map(ind =>

                                ind.id === id

                                  ? { ...ind, options }

                                  : ind

                              )

                            );

                          }}

                        />

                      )}

                    </div>

                  ))}

                </div>

              </TabPanel>

              <TabPanel>

                <div className="mt-4">

                  <div className="flex justify-between mb-4">

                    <h3 className="text-xl font-bold">전략 알림 설정</h3>

                    <button

                      className="px-4 py-2 bg-blue-500 rounded hover:bg-blue-600"

                      onClick={() => {

                        setStrategies(prev => [...prev, {

                          id: `strategy_${Date.now()}`,

                          name: '새 전략',

                          active: false,

                          buyConditions: [{

                            id: `buy_${Date.now()}`,

                            indicator: 'ma20',

                            operator: 'crosses_above',

                            compareWith: 'ma50'

                          }],

                          sellConditions: [{

                            id: `sell_${Date.now()}`,

                            indicator: 'ma20',

                            operator: 'crosses_below',

                            compareWith: 'ma50'

                          }],

                          notification: {

                            browser: true,

                            sound: true

                          }

                        }]);

                      }}

                    >

                      새 전략 추가

                    </button>

                  </div>

                  

                  {strategies.map(strategy => (

                    <StrategyAlert

                      key={strategy.id}

                      strategy={strategy}

                      onUpdate={(updatedStrategy) => {

                        setStrategies(prev =>

                          prev.map(s => s.id === updatedStrategy.id ? {

                            ...updatedStrategy,

                            action: updatedStrategy.action ? {

                              type: updatedStrategy.action.type || 'buy',

                              amount: updatedStrategy.action.amount || 0,

                              stopLoss: updatedStrategy.action.stopLoss,

                              takeProfit: updatedStrategy.action.takeProfit

                            } : undefined

                          } : s)

                        );

                      }}

                      onDelete={(id) => {

                        setStrategies(prev => prev.filter(s => s.id !== id));

                      }}

                    />

                  ))}

                </div>

              </TabPanel>

              <TabPanel>

                <div className="mt-4">

                  <div className="flex justify-between items-center mb-4">

                    <h3 className="text-xl font-bold">거래 내역</h3>

                    <div className="text-lg">

                      잔고: <span className="text-green-500">${balance.toFixed(2)} USDT</span>

                    </div>

                  </div>

                  <div className="space-y-4">

                    {trades.map(trade => (

                      <div

                        key={trade.id}

                        className={`p-4 rounded bg-[#2B2B2B] border-l-4 ${

                          trade.type === 'buy' ? 'border-green-500' : 'border-red-500'

                        }`}

                      >

                        <div className="flex justify-between items-start">

                          <div>

                            <span className="font-bold">{trade.symbol}</span>

                            <span className="mx-2">•</span>

                            <span className={trade.type === 'buy' ? 'text-green-500' : 'text-red-500'}>

                              {trade.type === 'buy' ? '매수' : '매도'}

                            </span>

                          </div>

                          <span className="text-sm text-gray-400">

                            {new Date(trade.timestamp).toLocaleString()}

                          </span>

                        </div>

                        <div className="mt-2 text-sm text-gray-400">

                          <div>수량: {trade.amount.toFixed(4)}</div>

                          <div>가격: ${trade.price.toFixed(2)}</div>

                          <div>전략: {trade.strategy}</div>

                        </div>

                      </div>

                    ))}

                  </div>

                </div>

              </TabPanel>

            </TabPanels>

          </TabGroup>

        </div>

      </div>

    </main>

  );

} 