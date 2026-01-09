import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App';
import InboxScreen from './screens/InboxScreen';
import ReviewScreen from './screens/ReviewScreen';
import TodayScreen from './screens/TodayScreen';
import DailyReviewScreen from './screens/DailyReviewScreen';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter basename="/make_now">
      <Routes>
        <Route path="/" element={<App />}> 
          <Route index element={<InboxScreen />} />
          <Route path="review/:id" element={<ReviewScreen />} />
          <Route path="today" element={<TodayScreen />} />
          <Route path="daily-review" element={<DailyReviewScreen />} />
        </Route>
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
