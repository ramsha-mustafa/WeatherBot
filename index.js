require('dotenv').config();
const apiKey = process.env.OPENWEATHER_API_KEY;


const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');

const app = express();

app.use(bodyParser.json());

app.post('/webhook', async (req, res) => {
    const intent = req.body.queryResult.intent.displayName;
    const parameters = req.body.queryResult.parameters;
    const city = parameters['geo-city'];

    if (!city) {
        return res.json({ fulfillmentText: 'Please provide a city name.' });
    }

    try {
        const geoUrl = `http://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(city)}&limit=1&appid=${apiKey}`;
        const geoResponse = await axios.get(geoUrl);
        const location = geoResponse.data[0];

        if (!location) {
            return res.json({ fulfillmentText: `Sorry, I couldn't find coordinates for ${city}.` });
        }

        const lat = location.lat;
        const lon = location.lon;

        if (intent === 'GetCurrentWeather') {
            const currentWeatherUrl = `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;
            const weatherResponse = await axios.get(currentWeatherUrl);
            const data = weatherResponse.data;

            const description = data.weather[0].description;
            const temp = data.main.temp;

            return res.json({
                fulfillmentText: `The current weather in ${city} is ${description} with a temperature of ${temp}°C.`
            });
        }

        if (intent === 'GetForecastWeather') {
            const forecastUrl = `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`;
            const forecastResponse = await axios.get(forecastUrl);
            const forecastList = forecastResponse.data.list;

            const dailyData = {};

            forecastList.forEach(item => {
                const date = item.dt_txt.split(' ')[0];
                if (!dailyData[date]) {
                    dailyData[date] = {
                        temps: [],
                        descriptions: []
                    };
                }
                dailyData[date].temps.push(item.main.temp);
                dailyData[date].descriptions.push(item.weather[0].description);
            });

            const today = new Date();
            const tomorrow = new Date(today);
            tomorrow.setDate(today.getDate() + 1);
            const tomorrowStr = tomorrow.toISOString().split('T')[0];

            const next5Dates = Object.keys(dailyData)
                .filter(date => date >= tomorrowStr)
                .slice(0, 5);

            let message = `Here’s the 5-day weather forecast for ${city} (starting from tomorrow):\n\n`;

            next5Dates.forEach(date => {
                const temps = dailyData[date].temps;
                const descs = dailyData[date].descriptions;

                const avgTemp = (temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(1);
                const mostCommonDesc = descs.sort((a, b) =>
                    descs.filter(v => v === a).length - descs.filter(v => v === b).length
                ).pop();

                message += `${date}: ${mostCommonDesc}, ${avgTemp}°C\n`;
            });

            return res.json({ fulfillmentText: message });
        }

    } catch (err) {
        console.error(err);
        return res.json({
            fulfillmentText: 'Sorry, I had trouble accessing the weather service.'
        });
    }
});

app.listen(3000, () => console.log('Webhook server running on port 3000'));
