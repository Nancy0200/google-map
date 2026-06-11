/**
 * navigation.js — 路段模擬：逢甲大學 → 台北101
 * 提供 window.Navigation API 給地圖與 UI 使用
 */

(function () {
    const ROUTE = [
        { road: '文華路',     city: '台中市西屯區', turnType: 'turn-right', nextRoad: '台灣大道',  nextTurnLabel: '右轉',  distKm: 0.8,  duration: 7000  },
        { road: '台灣大道',   city: '台中市西屯區', turnType: 'straight',   nextRoad: '中清路',    nextTurnLabel: '直行',  distKm: 2.3,  duration: 9000  },
        { road: '中清路',     city: '台中市北屯區', turnType: 'ramp',       nextRoad: '國道一號',  nextTurnLabel: '上交流道', distKm: 1.2,  duration: 7000  },
        { road: '國道一號',   city: '台中→豐原',   turnType: 'straight',   nextRoad: '國道一號',  nextTurnLabel: '直行',  distKm: 15.0, duration: 11000 },
        { road: '國道一號',   city: '豐原→后里',   turnType: 'straight',   nextRoad: '國道三號',  nextTurnLabel: '轉國三', distKm: 12.0, duration: 10000 },
        { road: '國道三號',   city: '后里→三義',   turnType: 'straight',   nextRoad: '國道三號',  nextTurnLabel: '直行',  distKm: 18.0, duration: 9000  },
        { road: '國道三號',   city: '三義→苗栗',   turnType: 'turn-left',  nextRoad: '國道一號',  nextTurnLabel: '左轉',  distKm: 22.0, duration: 8000  },
        { road: '國道一號',   city: '苗栗→新竹',   turnType: 'straight',   nextRoad: '國道一號',  nextTurnLabel: '直行',  distKm: 28.0, duration: 10000 },
        { road: '國道一號',   city: '新竹→桃園',   turnType: 'straight',   nextRoad: '國道一號',  nextTurnLabel: '直行',  distKm: 35.0, duration: 11000 },
        { road: '國道一號',   city: '桃園→林口',   turnType: 'straight',   nextRoad: '新台五路',  nextTurnLabel: '右轉',  distKm: 20.0, duration: 9000  },
        { road: '新台五路',   city: '新北市五股區', turnType: 'turn-right', nextRoad: '承德路',    nextTurnLabel: '右轉',  distKm: 3.0,  duration: 5000  },
        { road: '承德路',     city: '台北市士林區', turnType: 'straight',   nextRoad: '中山北路',  nextTurnLabel: '直行',  distKm: 5.0,  duration: 6000  },
        { road: '中山北路',   city: '台北市中山區', turnType: 'turn-right', nextRoad: '忠孝東路',  nextTurnLabel: '右轉',  distKm: 4.0,  duration: 8000  },
        { road: '忠孝東路',   city: '台北市信義區', turnType: 'straight',   nextRoad: '信義路',    nextTurnLabel: '直行',  distKm: 2.0,  duration: 7000  },
        { road: '信義路',     city: '台北市信義區', turnType: 'turn-left',  nextRoad: '松壽路',    nextTurnLabel: '左轉',  distKm: 1.0,  duration: 5000  },
        { road: '松壽路',     city: '台北101 附近', turnType: 'arrive',     nextRoad: '台北101',   nextTurnLabel: '到達',  distKm: 0.3,  duration: 4000  },
    ];

    const TOTAL_KM = 178;
    const TOTAL_DUR = ROUTE.reduce((s, r) => s + r.duration, 0);

    let segIdx = 0;
    const listeners = [];
    let segTimer = null;

    function getProgress() {
        let elapsed = 0;
        for (let i = 0; i < segIdx; i++) elapsed += ROUTE[i].duration;
        return Math.min(elapsed / TOTAL_DUR, 1);
    }

    function notify() {
        const seg  = ROUTE[segIdx];
        const next = ROUTE[Math.min(segIdx + 1, ROUTE.length - 1)];
        listeners.forEach(cb => cb({
            road:           seg.road,
            city:           seg.city,
            turnType:       seg.turnType,
            nextRoad:       seg.nextRoad,
            nextTurnLabel:  seg.nextTurnLabel,
            distKm:         seg.distKm,
            progress:       getProgress(),
            isHighway:      seg.road.startsWith('國道'),
            isArrived:      segIdx >= ROUTE.length - 1,
        }));
    }

    function advance() {
        if (segIdx >= ROUTE.length - 1) {
            // 到達後 6 秒重新出發
            setTimeout(() => {
                segIdx = 0;
                notify();
                scheduleNext();
            }, 6000);
            return;
        }
        segIdx++;
        notify();
        scheduleNext();
    }

    function scheduleNext() {
        if (segTimer) clearTimeout(segTimer);
        segTimer = setTimeout(advance, ROUTE[segIdx].duration);
    }

    function init() {
        notify();
        scheduleNext();
    }

    window.Navigation = {
        getCurrentRoad:    () => ROUTE[segIdx].road,
        getCurrentCity:    () => ROUTE[segIdx].city,
        getCurrentSegment: () => ({ road: ROUTE[segIdx].road, city: ROUTE[segIdx].city }),
        getProgress:       getProgress,
        onRoadChange:      (cb) => { listeners.push(cb); },
    };

    init();
})();
