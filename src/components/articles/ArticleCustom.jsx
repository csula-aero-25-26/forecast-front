import "./ArticleCustom.scss";
import React from "react";
import Article from "/src/components/articles/base/Article.jsx";
import PredictLatestButton from "/src/components/prediction/PredictLatestButton.jsx";

/**
 * @param {ArticleDataWrapper} dataWrapper
 * @return {JSX.Element}
 * @constructor
 */
function ArticleCustom({ dataWrapper }) {
  return (
    <Article
      id={dataWrapper.uniqueId}
      type={Article.Types.SPACING_DEFAULT}
      dataWrapper={dataWrapper}
      className="article-custom"
    >
      <div className="article-custom-content">
        <h3 className="article-custom-title">
          {dataWrapper.locales?.title || "Solar Flux Prediction"}
        </h3>
        <PredictLatestButton />
      </div>
    </Article>
  );
}

export default ArticleCustom;
