import React, { useState } from 'react';
import { Printer } from 'lucide-react';

import { calculateSummaryStats, getPercentageColor } from '../utils';

const ReportsDashboard = ({ people, sections, attendanceData, outRecords, onSelectPerson, onBack, dailyScheduleOverrides, onPrint }) => {
    const [startDate, setStartDate] = useState(null);
    const [endDate, setEndDate] = useState(null);
    
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

    return (
        <div id="dashboard-report-printable" className="bg-gray-800 p-6 rounded-lg printable-container">
            <div className="flex justify-between items-center mb-6 no-print">
                <h2 className="text-2xl font-bold">Reports Dashboard</h2>
                <div className="flex gap-2">
                    <button onClick={() => onPrint('dashboard-report-printable')} className="flex items-center gap-2 px-4 py-2 bg-blue-600 rounded-lg hover:bg-blue-700">
                        <Printer size={20} />
                        <span>Print</span>
                    </button>
                    <button onClick={onBack} className="px-4 py-2 bg-gray-700 rounded-lg hover:bg-gray-600">Back to Grid</button>
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

            <div className="bg-gray-900/50 p-4 rounded-lg">
                <ul className="space-y-2">
                    {people.map(person => {
                        const { presentPercentage } = calculateSummaryStats(person.id, attendanceData, sections, dailyScheduleOverrides, startDate, endDate, outRecords);
                        return (
                            <li key={person.id}>
                                <button 
                                    onClick={() => onSelectPerson(person.id)}
                                    className="w-full text-left p-3 bg-gray-700 rounded-md hover:bg-gray-600 transition-colors flex justify-between items-center"
                                >
                                    <span>{person.firstName} {person.lastName}</span>
                                    <span className={`font-bold ${getPercentageColor(presentPercentage)}`}>
                                        {presentPercentage === "N/A" ? "N/A" : `${presentPercentage}%`}
                                    </span>
                                </button>
                            </li>
                        )
                    })}
                </ul>
            </div>
        </div>
    );
};

export default ReportsDashboard;