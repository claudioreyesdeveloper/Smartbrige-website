"use server"

export async function sendSuggestion(formData: FormData) {
  const name = formData.get("name") as string
  const email = formData.get("email") as string
  const keyboardModel = formData.get("keyboardModel") as string
  const platform = formData.get("platform") as string
  const feedbackType = formData.get("feedbackType") as string
  const message = formData.get("message") as string

  // Validation
  if (!email || !message) {
    return { success: false, error: "Email and message are required" }
  }

  try {
    const emailBody = `
New SmartBridge Feedback

From: ${name || "Not provided"}
Email: ${email}
Keyboard Model: ${keyboardModel || "Not specified"}
Platform: ${platform || "Not specified"}
Feedback Type: ${feedbackType || "Not specified"}

Message:
${message}
    `.trim()

    console.log("[v0] Feedback received:")
    console.log(emailBody)
    console.log("[v0] Would send to: claudio.private@gmail.com")

    // TODO: Integrate with email service (Resend, SendGrid, etc.)
    // Example with Resend:
    // const { data, error } = await resend.emails.send({
    //   from: 'SmartBridge <feedback@smartbridge.app>',
    //   to: 'claudio.private@gmail.com',
    //   subject: `SmartBridge Feedback: ${feedbackType || 'General'}`,
    //   text: emailBody,
    //   replyTo: email,
    // })

    return { success: true }
  } catch (error) {
    console.error("[v0] Error sending feedback:", error)
    return { success: false, error: "Failed to send feedback" }
  }
}

export async function sendFeatureFeedback(featureName: string, message: string) {
  // Validation
  if (!featureName || !message) {
    return { success: false, error: "Feature name and message are required" }
  }

  try {
    const emailBody = `
New SmartBridge Feature Feedback

Feature: ${featureName}

Message:
${message}
    `.trim()

    console.log("[v0] Feature feedback received:")
    console.log(emailBody)
    console.log("[v0] Would send to: claudio.private@gmail.com")

    // TODO: Integrate with email service (Resend, SendGrid, etc.)
    // Example with Resend:
    // const { data, error } = await resend.emails.send({
    //   from: 'SmartBridge <feedback@smartbridge.app>',
    //   to: 'claudio.private@gmail.com',
    //   subject: `SmartBridge Feedback: ${featureName}`,
    //   text: emailBody,
    // })

    return { success: true }
  } catch (error) {
    console.error("[v0] Error sending feature feedback:", error)
    return { success: false, error: "Failed to send feedback" }
  }
}
