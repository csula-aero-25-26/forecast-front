import "./AvatarView.scss"
import React, {useEffect, useState} from 'react'
import ImageView from "/src/components/generic/ImageView.jsx"

function AvatarView({ src = "", alt = "", faIcon = "", className = "", id = null, style = null, cycleInterval = 3000 }) {
    const [currentIndex, setCurrentIndex] = useState(0)
    const sources = Array.isArray(src) ? src : (src ? [src] : [])

    useEffect(() => {
        if (!sources || sources.length <= 1) return
        setCurrentIndex(0)
        const t = setInterval(() => {
            setCurrentIndex((i) => (i + 1) % sources.length)
        }, cycleInterval)
        return () => clearInterval(t)
    }, [src, cycleInterval])

    const currentSrc = sources.length ? sources[currentIndex] : ""

        return (
        <div className={`avatar-view ${className}`}
                 id={id}
                 style={style}>
            {currentSrc ? (
                <ImageView src={currentSrc}
                                     alt={alt}
                                     className={`avatar-view-image-view`}/>
            ) : (
                <div className={`avatar-icon-view`}>
                    <i className={`${faIcon}`}/>
                </div>
            )}
        </div>
    )
}

export default AvatarView