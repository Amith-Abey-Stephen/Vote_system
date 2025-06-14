import React, { useEffect, useRef } from 'react';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface VoteChartProps {
  title: string;
  data: Record<string, number>;
  color: 'blue' | 'pink' | 'yellow' | 'orange';
}

const VoteChart: React.FC<VoteChartProps> = ({ title, data, color }) => {
  const colorMap = {
    blue: {
      background: 'rgba(59, 130, 246, 0.5)',
      border: 'rgba(59, 130, 246, 1)',
    },
    pink: {
      background: 'rgba(236, 72, 153, 0.5)',
      border: 'rgba(236, 72, 153, 1)',
    },
    yellow: {
      background: 'rgba(245, 158, 11, 0.5)',
      border: 'rgba(245, 158, 11, 1)',
    },
    orange: {
      background: 'rgba(249, 115, 22, 0.5)',
      border: 'rgba(249, 115, 22, 1)',
    }
  };

  const chartData = {
    labels: Object.keys(data),
    datasets: [
      {
        label: 'Votes',
        data: Object.values(data),
        backgroundColor: colorMap[color].background,
        borderColor: colorMap[color].border,
        borderWidth: 1,
      },
    ],
  };

  const options = {
    responsive: true,
    plugins: {
      legend: {
        display: false,
      },
      title: {
        display: true,
        text: title,
        font: {
          size: 16,
          weight: 'bold',
        },
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          stepSize: 1,
        },
      },
    },
  };

  if (Object.keys(data).length === 0) {
    return (
      <div className="bg-white rounded-lg p-6 border border-gray-200">
        <h3 className="text-lg font-semibold mb-4">{title}</h3>
        <div className="text-center py-12 text-gray-500">
          <p>No votes recorded yet</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg p-6 border border-gray-200">
      <Bar data={chartData} options={options} />
    </div>
  );
};

export default VoteChart;