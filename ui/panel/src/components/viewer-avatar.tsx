import { useState } from "react"

export function ViewerAvatar({ name, url }: { name: string; url?: string }) {
  const [failedUrl, setFailedUrl] = useState("")
  return (
    <span className="chat-viewer-avatar" aria-hidden="true">
      {name.slice(0, 1).toUpperCase()}
      {url && failedUrl !== url && (
        <img
          src={url}
          alt=""
          referrerPolicy="no-referrer"
          onError={() => setFailedUrl(url)}
        />
      )}
    </span>
  )
}
