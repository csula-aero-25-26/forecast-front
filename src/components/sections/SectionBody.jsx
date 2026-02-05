import "./SectionBody.scss";
import React, { useEffect, useState, createContext } from "react";
import { useParser } from "/src/hooks/parser.js";
import ArticleCards from "/src/components/articles/ArticleCards.jsx";
import ArticleContactForm from "/src/components/articles/ArticleContactForm.jsx";
import ArticleFacts from "/src/components/articles/ArticleFacts.jsx";
import ArticleInfoList from "/src/components/articles/ArticleInfoList.jsx";
import ArticleInlineList from "/src/components/articles/ArticleInlineList.jsx";
import ArticleNotFound from "/src/components/articles/ArticleNotFound.jsx";
import ArticlePortfolio from "/src/components/articles/ArticlePortfolio.jsx";
import ArticleStack from "/src/components/articles/ArticleStack.jsx";
import ArticleSkills from "/src/components/articles/ArticleSkills.jsx";
import ArticleTestimonials from "/src/components/articles/ArticleTestimonials.jsx";
import ArticleText from "/src/components/articles/ArticleText.jsx";
import ArticleThread from "/src/components/articles/ArticleThread.jsx";
import ArticleTimeline from "/src/components/articles/ArticleTimeline.jsx";
import ArticleChart from "/src/components/articles/ArticleChart.jsx";
import ArticleDateRange from "/src/components/articles/ArticleDateRange.jsx";
import ArticleChatBox from "/src/components/articles/ArticleChatBox.jsx";
import ArticlePrediction from "/src/components/articles/ArticlePrediction.jsx";


import ArticleCustom from "/src/components/articles/ArticleCustom.jsx";

function SectionBody({ section }) {
  const parser = useParser();
  const articleDataWrappers = parser.parseSectionArticles(section);

    const [dateRange, setDateRange] = useState(null)

    return (
        <div className={`section-body`}>
            <SectionBody.Context.Provider value={{ dateRange, setDateRange }}>
                {articleDataWrappers && articleDataWrappers.map((dataWrapper, key) => {
                    const Component = SectionBody.ARTICLES[dataWrapper.component] || ArticleNotFound
                    return <Component dataWrapper={dataWrapper}
                                      id={key}
                                      key={key}/>
                })}
            </SectionBody.Context.Provider>
        </div>
    )
}

SectionBody.Context = createContext({ dateRange: null, setDateRange: () => {} })

SectionBody.ARTICLES = {
ArticleCards,
ArticleContactForm,
ArticleFacts,
ArticleInfoList,
ArticleInlineList,
ArticleNotFound,
ArticlePortfolio,
ArticleSkills,
ArticleStack,
ArticleTestimonials,
ArticleText,
ArticleThread,
ArticleTimeline,
ArticleChart,
ArticleDateRange,
ArticleChatBox,
ArticlePrediction,
ArticleCustom,
};


export default SectionBody;
