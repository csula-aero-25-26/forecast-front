import "./ArticleChart.scss"
import React, {useState, useMemo} from 'react'
import Article from "/src/components/articles/base/Article.jsx"
import {BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer} from 'recharts'
import {useTheme} from "/src/providers/ThemeProvider.jsx"
import {useUtils} from "/src/hooks/utils.js"

/**
 * @param {ArticleDataWrapper} dataWrapper
 * @param {Number} id
 * @return {JSX.Element}
 * @constructor
 */
function ArticleChart({ dataWrapper, id }) {
    const [selectedItemCategoryId, setSelectedItemCategoryId] = useState(null)

    return (
        <Article id={dataWrapper.uniqueId}
                 type={Article.Types.SPACING_DEFAULT}
                 dataWrapper={dataWrapper}
                 className={`article-chart`}
                 selectedItemCategoryId={selectedItemCategoryId}
                 setSelectedItemCategoryId={setSelectedItemCategoryId}>
            <ArticleChartItems dataWrapper={dataWrapper} 
                                   selectedItemCategoryId={selectedItemCategoryId}/>
        </Article>
    )
}

/**
 * @param {ArticleDataWrapper} dataWrapper
 * @param {String} selectedItemCategoryId
 * @return {JSX.Element}
 * @constructor
 */
function ArticleChartItems({ dataWrapper, selectedItemCategoryId }) {
    const filteredItems = dataWrapper.getOrderedItemsFilteredBy(selectedItemCategoryId)
    const theme = useTheme()
    const utils = useUtils()
    
    // Convert items to chart data format
    const chartData = useMemo(() => {
        return filteredItems.map(itemWrapper => {
            const name = itemWrapper.locales?.label || 
                        itemWrapper.locales?.title || 
                        itemWrapper.label || 
                        `Item ${itemWrapper.id}`
            
            const value = itemWrapper.percentage !== undefined ? 
                         itemWrapper.percentage : 
                         (itemWrapper.dateStart ? itemWrapper.dateStart.getTime() : itemWrapper.id)
            
            return {
                name: utils.string.stripHTMLTags(name),
                value: value,
                fullValue: value,
                id: itemWrapper.id
            }
        })
    }, [filteredItems, utils])

    const chartType = dataWrapper.settings?.chartType || 'bar'
    const chartHeight = dataWrapper.settings?.chartHeight || 400
    const showGrid = dataWrapper.settings?.showGrid !== false
    const showLegend = dataWrapper.settings?.showLegend !== false
    const showTooltip = dataWrapper.settings?.showTooltip !== false

    const isDarkTheme = theme.getSelectedTheme()?.dark
    const textColor = isDarkTheme ? '#ffffff' : '#333333'
    const gridColor = isDarkTheme ? '#444444' : '#e0e0e0'

    if (chartData.length === 0) {
        return (
            <div className={`article-chart-empty`}>
                No data available for chart
            </div>
        )
    }

    const renderChart = () => {
        const commonProps = {
            data: chartData,
            margin: { top: 5, right: 30, left: 20, bottom: 5 }
        }

        switch (chartType.toLowerCase()) {
            case 'line':
                return (
                    <ResponsiveContainer width="100%" height={chartHeight}>
                        <LineChart {...commonProps}>
                            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />}
                            <XAxis 
                                dataKey="name" 
                                tick={{ fill: textColor }}
                                tickFormatter={(value) => value.length > 10 ? `${value.substring(0, 10)}...` : value}
                            />
                            <YAxis tick={{ fill: textColor }} />
                            {showTooltip && <Tooltip contentStyle={{ backgroundColor: isDarkTheme ? '#2a2a2a' : '#ffffff', color: textColor, border: `1px solid ${gridColor}` }} />}
                            {showLegend && <Legend wrapperStyle={{ color: textColor }} />}
                            <Line 
                                type="monotone" 
                                dataKey="value" 
                                stroke="#FFCE00" 
                                strokeWidth={2}
                                dot={{ fill: '#FFCE00' }}
                                activeDot={{ r: 6 }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                )

            case 'area':
                return (
                    <ResponsiveContainer width="100%" height={chartHeight}>
                        <AreaChart {...commonProps}>
                            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />}
                            <XAxis 
                                dataKey="name" 
                                tick={{ fill: textColor }}
                                tickFormatter={(value) => value.length > 10 ? `${value.substring(0, 10)}...` : value}
                            />
                            <YAxis tick={{ fill: textColor }} />
                            {showTooltip && <Tooltip contentStyle={{ backgroundColor: isDarkTheme ? '#2a2a2a' : '#ffffff', color: textColor, border: `1px solid ${gridColor}` }} />}
                            {showLegend && <Legend wrapperStyle={{ color: textColor }} />}
                            <Area 
                                type="monotone" 
                                dataKey="value" 
                                stroke="#FFCE00" 
                                fill="#FFCE00"
                                fillOpacity={0.6}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                )

            case 'pie':
                const COLORS = ['#FFCE00', '#82ca9d', '#ffc658', '#ff7300', '#00ff00', '#0088fe', '#00c49f', '#ffbb28', '#ff8042']
                return (
                    <ResponsiveContainer width="100%" height={chartHeight}>
                        <PieChart>
                            {showTooltip && <Tooltip contentStyle={{ backgroundColor: isDarkTheme ? '#2a2a2a' : '#ffffff', color: textColor, border: `1px solid ${gridColor}` }} />}
                            {showLegend && <Legend wrapperStyle={{ color: textColor }} />}
                            <Pie
                                data={chartData}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                                outerRadius={chartHeight / 3}
                                fill="#FFCE00"
                                dataKey="value"
                            >
                                {chartData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                ))}
                            </Pie>
                        </PieChart>
                    </ResponsiveContainer>
                )

            case 'bar':
            default:
                return (
                    <ResponsiveContainer width="100%" height={chartHeight}>
                        <BarChart {...commonProps}>
                            {showGrid && <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />}
                            <XAxis 
                                dataKey="name" 
                                tick={{ fill: textColor }}
                                tickFormatter={(value) => value.length > 10 ? `${value.substring(0, 10)}...` : value}
                            />
                            <YAxis tick={{ fill: textColor }} />
                            {showTooltip && <Tooltip contentStyle={{ backgroundColor: isDarkTheme ? '#2a2a2a' : '#ffffff', color: textColor, border: `1px solid ${gridColor}` }} />}
                            {showLegend && <Legend wrapperStyle={{ color: textColor }} />}
                            <Bar dataKey="value" fill="#FFCE00" />
                        </BarChart>
                    </ResponsiveContainer>
                )
        }
    }

    return (
        <div className={`article-chart-items`}>
            {renderChart()}
        </div>
    )
}

export default ArticleChart
