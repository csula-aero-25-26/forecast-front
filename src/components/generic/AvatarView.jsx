import "./AvatarView.scss"
import React, {useEffect, useState} from 'react'
import ImageView from "/src/components/generic/ImageView.jsx"

function AvatarView({ src = "", singleSrc = null, fallbackChain = [], alt = "", faIcon = "", className = "", id = null, style = null, cycleInterval = 3000 }) {
    const [currentIndex, setCurrentIndex] = useState(0)
    const [singleDisplayedSrc, setSingleDisplayedSrc] = useState(null)
    const [errorAttempts, setErrorAttempts] = useState(0)

    const sources = Array.isArray(src) ? src : (src ? [src] : [])

    useEffect(() => {
        if (!sources || sources.length <= 1) return
        setCurrentIndex(0)
        const t = setInterval(() => {
            setCurrentIndex((i) => (i + 1) % sources.length)
        }, cycleInterval)
        return () => clearInterval(t)
    }, [src, cycleInterval])

    // controlled single source with fallbacks
    useEffect(() => {
        if(singleSrc) {
            setSingleDisplayedSrc(singleSrc)
            setErrorAttempts(0)
        }
    }, [singleSrc])

    const currentSrc = singleDisplayedSrc ? singleDisplayedSrc : (sources.length ? sources[currentIndex] : "")

    const _onImageStatus = (status) => {
        if(status !== "error") return
        if(!singleDisplayedSrc) return
        // pick the next fallback based on current attempt count (supports any number of fallbacks)
        const nextIndex = errorAttempts
        if(fallbackChain && fallbackChain.length > nextIndex) {
            setSingleDisplayedSrc(fallbackChain[nextIndex])
            setErrorAttempts(nextIndex + 1)
        }
    }

        return (
        <div className={`avatar-view ${className}`}
                 id={id}
                 style={style}>
            {currentSrc ? (
                <ImageView src={currentSrc}
                                     alt={alt}
                                     className={`avatar-view-image-view`}
                                     onStatus={_onImageStatus}/>
            ) : (
                <div className={`avatar-icon-view`}>
                    <i className={`${faIcon}`}/>
                </div>
            )}
        </div>
    )
}

export default AvatarView