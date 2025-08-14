import React, { useState, useMemo } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { Printer } from 'lucide-react';

import { calculateSummaryStats, getPercentageColor } from '../utils';

const ComprehensiveStudentReport = ({ personId, people, sections, persistentNotes, attendanceData, outRecords, onBack, dailyScheduleOverrides, onPrint }) => {
    const person = people.find(p => p.id === personId);
    const [startDate, setStartDate] = useState(null);
    const [endDate, setEndDate] = useState(null);

    const summaryStats = useMemo(() => {
        return calculateSummaryStats(personId, attendanceData, sections, dailyScheduleOverrides, startDate, endDate, outRecords);
    }, [personId, attendanceData, sections, dailyScheduleOverrides, startDate, endDate, outRecords]);
    
    const weeklyPerformanceData = useMemo(() => {
        const getWeekIdentifier = (dateStr) => {
            const date = new Date(dateStr);
            const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
            d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
            const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
            const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
            return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
        };

        const weeklyStats = {};
        
        const datesToProcess = Object.keys(attendanceData).filter(date => {
            const currentDateObj = new Date(date);
            const currentDate = new Date(currentDateObj.valueOf() + currentDateObj.getTimezoneOffset() * 60 * 1000);
            if (startDate && currentDate < startDate) return false;
            if (endDate && currentDate > endDate) return false;
            return true;
        });

        datesToProcess.forEach(date => {
            const personDayData = attendanceData[date]?.[personId];
            const weekId = getWeekIdentifier(date);
            if (!weeklyStats[weekId]) {
                weeklyStats[weekId] = { totalMinutesPossible: 0, totalMinutesAttended: 0, week: weekId };
            }
            
            const sectionsForThisDay = sections.map(sec => {
                const override = dailyScheduleOverrides.find(o => o.sectionId === sec.id && o.date === date);
                return { ...sec, startTime: override ? override.newTime : sec.startTime };
            });

            sectionsForThisDay.forEach(section => {
                 const wasClassHeldForAnyStudent = attendanceData[date] && Object.values(attendanceData[date]).some(personRecords => personRecords[section.id]);
                 if(wasClassHeldForAnyStudent) {
                    const record = personDayData?.[section.id];
                    const isOut = isPersonMarkedOut(personId, date, section.id, sections, outRecords);
                    
                    if (!isOut && record?.status !== 'Excused') {
                         weeklyStats[weekId].totalMinutesPossible += section.duration;
                         if (record && record.status === 'On Time') {
                             weeklyStats[weekId].totalMinutesAttended += section.duration;
                         } else if (record && record.status === 'Late') {
                             weeklyStats[weekId].totalMinutesAttended += Math.max(0, section.duration - (record.minutesLate || 0));
                         }
                    }
                 }
            });
        });
        
        return Object.values(weeklyStats)
            .filter(stats => stats.totalMinutesPossible > 0)
            .map((stats) => ({
                week: stats.week,
                percentage: (stats.totalMinutesAttended / stats.totalMinutesPossible) * 100,
            }))
            .sort((a, b) => a.week.localeCompare(b.week));

    }, [personId, attendanceData, sections, dailyScheduleOverrides, outRecords, startDate, endDate]);

    const handlePresetSelect = (preset) => {
        let start, end;
        const today = new Date();
        end = today;

        switch(preset) {
            case 'week':
                start = new Date(today);
                start.setDate(today.getDate() - today.getDay()); // Sunday
                break;
            case 'month':
                start = new Date(today.getFullYear(), today.getMonth(), 1);
                break;
            default: // all
                start = null;
                end = null;
        }
        setStartDate(start);
        setEndDate(end);
    };

    if (!person) {
        return <div>Loading...</div>;
    }

    return (
        <div id="comprehensive-report-printable" className="bg-gray-800 p-6 rounded-lg printable-container">
            <div className="flex justify-between items-center mb-6 no-print">
                <h2 className="text-2xl font-bold">Report for {person.firstName} {person.lastName}</h2>
                <div className="flex gap-2">
                    <button onClick={() => onPrint('comprehensive-report-printable')} className="flex items-center gap-2 px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700">
                        <Printer size={20} />
                        <span>Print</span>
                    </button>
                    <button onClick={onBack} className="px-4 py-2 bg-gray-700 rounded-lg hover:bg-gray-600">Back to Reports</button>
                </div>
            </div>
            
            <div className="bg-gray-900/50 p-4 rounded-lg mb-6 flex flex-col md:flex-row items-center justify-between gap-4 flex-wrap no-print">
                <div className="flex items-center gap-2">
                    <label className="text-sm">From:</label>
                    <input type="date" value={startDate ? startDate.toISOString().split('T')[0] : ''} onChange={(e) => setStartDate(e.target.value ? new Date(e.target.value) : null)} className="bg-gray-700 rounded-md p-2"/>
                    <label className="text-sm">To:</label>
                    <input type="date" value={endDate ? endDate.toISOString().split('T')[0] : ''} onChange={(e) => setEndDate(e.target.value ? new Date(e.target.value) : null)} className="bg-gray-700 rounded-md p-2"/>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={() => handlePresetSelect('week')} className="px-3 py-1 text-sm bg-gray-700 rounded-md hover:bg-gray-600">This Week</button>
                    <button onClick={() => handlePresetSelect('month')} className="px-3 py-1 text-sm bg-gray-700 rounded-md hover:bg-gray-600">This Month</button>
                    <button onClick={() => handlePresetSelect('all')} className="px-3 py-1 text-sm bg-gray-700 rounded-md hover:bg-gray-600">All Time</button>
                </div>
            </div>

            <div className="bg-gray-900 p-4 rounded-lg mb-6 summary-grid">
                <div className="text-center">
                    <p className="text-sm text-gray-400 stat-label">Percentage of Minutes Present</p>
                    <p className={`text-3xl font-bold ${getPercentageColor(summaryStats.presentPercentage)} stat-value`}>
                        {summaryStats.presentPercentage === "N/A" ? "N/A" : `${summaryStats.presentPercentage}%`}
                    </p>
                </div>
                <div className="text-center">
                    <p className="text-sm text-gray-400 stat-label">Total Minutes Late</p>
                    <p className={`text-3xl font-bold text-yellow-400 stat-value`}>{summaryStats.totalMinutesLate}</p>
                </div>
            </div>
            
            <h3 className="text-xl font-bold mb-4 mt-8">Weekly Performance Trend</h3>
            <div className="bg-gray-900/50 p-4 rounded-lg h-72">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={weeklyPerformanceData} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#4A5568" />
                        <XAxis dataKey="week" stroke="#A0AEC0" />
                        <YAxis unit="%" domain={[0, 100]} stroke="#A0AEC0"/>
                        <Tooltip contentStyle={{ backgroundColor: '#2D3748', border: '1px solid #4A5568' }}/>
                        <Legend />
                        <Line type="monotone" dataKey="percentage" stroke="#63B3ED" name="Attendance %" strokeWidth={2} />
                    </LineChart>
                </ResponsiveContainer>
            </div>
            
            <h3 className="text-xl font-bold mb-4 mt-8">Per-Class Report</h3>
            <div className="bg-gray-900/50 p-4 rounded-lg">
                <ul className="space-y-2 per-class-list">
                    {sections.map((section) => {
                        const pNote = persistentNotes[personId]?.[section.id];
                        const classStats = summaryStats.perClassStats[section.id];
                        return (
                            <li key={section.id}>
                                <div className="text-left">
                                    <span className="font-semibold">{section.name} ({section.startTime})</span>
                                </div>
                                <div className="text-center">
                                    {pNote && <span className="text-xs text-cyan-400 italic">{pNote}</span>}
                                </div>
                                <div className="text-right">
                                    <span className={`text-lg font-bold ${getPercentageColor(classStats?.percentage)}`}>
                                        {classStats?.percentage === "N/A" ? "N/A" : `${classStats?.percentage}%`}
                                    </span>
                                </div>
                            </li>
                        )
                    })}
                </ul>
            </div>
        </div>
    )
}

export default ComprehensiveStudentReport;