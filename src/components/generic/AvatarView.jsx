import "./AvatarView.scss"
import React, {useEffect, useState} from 'react'
import ImageView from "/src/components/generic/ImageView.jsx"

function AvatarView({ src = "", alt = "", faIcon = "", className = "",  id = null, style = null }) {
    const [currentIndex, setCurrentIndex] = useState(0)

    const sources = Array.isArray(src) ? src : (src ? [src] : [])

    useEffect(() => {
        if(!sources || sources.length <= 1) return

        const interval = setInterval(() => {
            setCurrentIndex(i => (i + 1) % sources.length)
        }, 3000)

        return () => clearInterval(interval)
    }, [src])

    const currentSrc = sources.length > 0 ? sources[currentIndex] : null

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