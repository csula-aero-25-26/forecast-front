import "./NavProfileCard.scss"
import React, {useEffect, useState} from 'react'
import {Card} from "react-bootstrap"
import {useLanguage} from "/src/providers/LanguageProvider.jsx"
import {useNavigation} from "/src/providers/NavigationProvider.jsx"
import {useUtils} from "/src/hooks/utils.js"
import AvatarView from "/src/components/generic/AvatarView.jsx"
import { getFrontFolderImages, normalizeImageSources } from "/src/hooks/utils/imageUtils.js"
import StatusCircle from "/src/components/generic/StatusCircle.jsx"
import TextTyper from "/src/components/generic/TextTyper.jsx"
import AudioButton from "/src/components/buttons/AudioButton.jsx"

function NavProfileCard({ profile, expanded }) {
    const language = useLanguage()
    const navigation = useNavigation()
    const utils = useUtils()

    const expandedClass = expanded ?
        `` :
        `nav-profile-card-shrink`

    const name = profile.name
    const stylizedName = language.getTranslation(profile.locales, "localized_name_stylized", null) ||
        language.getTranslation(profile.locales, "localized_name", null) ||
        name

    let roles = language.getTranslation(profile.locales, "roles", [])
    if(utils.storage.getWindowVariable("suspendAnimations") && roles.length > 2)
        roles = [roles[0]]

    const rawProfilePic = language.parseJsonText(profile.profilePictureUrl)
    let profileSources = (rawProfilePic && normalizeImageSources(rawProfilePic)) || getFrontFolderImages()


    if (profileSources.length === 1 && typeof profileSources[0] === 'string' && profileSources[0].includes('/images/content/')) {
        profileSources = getFrontFolderImages()
    }

    const [currentDisplayedWord, setCurrentDisplayedWord] = useState(null)

    function slugify(name) {
        return String(name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")
    }

    const extensions = ['png', 'jpg']

    const findImageForWord = (word, sources = profileSources) => {
        if (!word || !sources || !sources.length) return null
        const lower = String(word).toLowerCase()
        const tokens = lower.split(/\s+/).filter(Boolean)

        if (lower.includes('advisor') || lower.includes('student members')) {
            return '/images/content/ae.png'
        }

        if (profile && profile.imageMap && Object.keys(profile.imageMap).length) {
            const map = {}
            for (const [k, v] of Object.entries(profile.imageMap)) {
                const nk = String(k).toLowerCase().trim()
                const nv = normalizeImageSources(v)
                if (nv && nv.length) map[nk] = nv[0]
            }

            if (map[lower]) return map[lower]
            const joined = tokens.join(' ')
            if (map[joined]) return map[joined]

            for (const [k, src] of Object.entries(map)) {
                if (k.includes(lower) || lower.includes(k)) return src
                const kTokens = k.split(/\s+/)
                if (kTokens[0] === tokens[0] && kTokens[1] && tokens[1] && kTokens[1].charAt(0) === tokens[1].charAt(0)) return src
            }
        }

        const slug = slugify(word)

        for (const src of sources) {
            const name = src.split('/').pop().replace(/\.[^/.]+$/, '')
            if (slugify(name) === slug) return src
        }

        for (const src of sources) {
            const name = src.split('/').pop().toLowerCase().replace(/\.[^/.]+$/, '')
            for (const token of tokens) {
                if (name.includes(token) || name.includes(token.slice(0, 4))) return src
            }
        }

        if (tokens.length >= 2) {
            const first = tokens[0]
            const lastInitial = tokens[1].charAt(0)
            for (const src of sources) {
                const name = src.split('/').pop().toLowerCase().replace(/\.[^/.]+$/, '')
                const parts = name.split(/\s+/)
                if (parts[0] === first && parts[1] && parts[1].charAt(0) === lastInitial) return src
            }
        }

        const candidates = [
            ...extensions.map(ext => `/images/content/${slug}/${slug}.${ext}`),
            ...extensions.map(ext => `/images/content/${slug}.${ext}`),
        ]
        for (const c of candidates) {
            if (sources.includes(c)) return c
        }

        return null
    }

    const currentImageSrc = currentDisplayedWord ? findImageForWord(currentDisplayedWord) : null
    const imageFallbacks = currentDisplayedWord ? (
        currentImageSrc ? ["/images/content/ae.png"] : [
            ...extensions.map(ext => `/images/content/${slugify(currentDisplayedWord)}/${slugify(currentDisplayedWord)}.${ext}`),
            ...extensions.map(ext => `/images/content/${slugify(currentDisplayedWord)}.${ext}`),
            "/images/content/ae.png"
        ]
    ) : ["/images/content/ae.png"]


    const statusCircleVisible = Boolean(profile.statusCircleVisible)
    const statusCircleVariant = statusCircleVisible ?
        profile.statusCircleVariant :
        ""

    const statusCircleHoverMessage = statusCircleVisible ?
        language.getTranslation(profile.locales, profile.statusCircleHoverMessage) :
        null

    const statusCircleSize = expanded ?
        StatusCircle.Sizes.DEFAULT :
        StatusCircle.Sizes.SMALL

    const namePronunciationIpa = language.getTranslation(profile.locales, "name_pronunciation_ipa", null)
    const namePronunciationAudioUrl = language.getTranslation(profile.locales, "name_pronunciation_audio_url", null)
    const namePronunciationButtonVisible = namePronunciationIpa || namePronunciationAudioUrl

    const navProfileCardNameClass = namePronunciationButtonVisible ?
        `nav-profile-card-name-with-audio-button` :
        ``

    const _onStatusBadgeClicked = () => {
        navigation.navigateToSectionWithId("contact")
    }

    return (
        <Card className={`nav-profile-card ${expandedClass}`}>
            <AvatarView src={profileSources}
                        singleSrc={currentImageSrc}
                        fallbackChain={imageFallbacks}
                        className={`nav-profile-card-avatar`}
                        alt={name}
                        cycleInterval={3000}/>

            {statusCircleVisible && (
                <StatusCircle className={`nav-profile-card-status-circle`}
                              variant={statusCircleVariant}
                              message={statusCircleHoverMessage}
                              size={statusCircleSize} onClick={_onStatusBadgeClicked}/>
            )}

            <div className={`nav-profile-card-info`}>
                <h1 className={`nav-profile-card-name ${navProfileCardNameClass}`}>
                    <span dangerouslySetInnerHTML={{__html: stylizedName}}/>
                    {namePronunciationButtonVisible && (
                        <AudioButton url={namePronunciationAudioUrl}
                                     tooltip={namePronunciationIpa}
                                     size={AudioButton.Sizes.DYNAMIC_FOR_NAV_TITLE}/>
                    )}
                </h1>

                {roles?.length > 1 && (
                    <TextTyper strings={roles}
                               id={`role-typer`}
                               className={`nav-profile-card-role`}
                               onWordChange={(word) => setCurrentDisplayedWord(word)}/>
                )}

                {roles?.length === 1 && (
                    <div className={`nav-profile-card-role`}
                         dangerouslySetInnerHTML={{__html: roles[0]}}/>
                )}
            </div>
        </Card>
    )
}

export default NavProfileCard