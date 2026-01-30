import "./ASCIISun.scss"
import React from "react"

const SUN_ART = [
    "        .        ",
    "      \\ | /      ",
    "    '-.;;;.-'    ",
    "   -==;;;;;==-   ",
    "    .-';;;'-.    ",
    "      / | \\      ",
    "       '         "
];



function ASCIISun({ className = "", hidden = false }) {
    const hiddenClass = hidden ? "ascii-sun-hidden" : ""

    return (
        <div className={`ascii-sun-wrapper ${className} ${hiddenClass}`}>
            <pre className="ascii-sun">
                {SUN_ART.join("\n")}
            </pre>
        </div>
    )
}

ASCIISun.ColorVariants = {
    LOADER: "ascii-sun-variant-loader"
}

export default ASCIISun
