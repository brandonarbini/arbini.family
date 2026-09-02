import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Text,
} from "react-email";

interface MagicLinkEmailProps {
  url: string;
  expiresInMinutes: number;
}

/**
 * The sign-in email. This link *is* the credential — anyone holding it is signed in — so the copy
 * says so plainly rather than burying it, and the address is never named in the body: the message
 * is already in the right inbox, and repeating the address only helps whoever it reached by
 * mistake.
 */
export function MagicLinkEmail({ url, expiresInMinutes }: MagicLinkEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Your link to sign in to arbini.family</Preview>
      <Body style={body}>
        <Container style={container}>
          <Heading style={heading}>arbini.family</Heading>
          <Text style={text}>
            Tap the button to sign in. The link works once and expires in{" "}
            {expiresInMinutes} minutes.
          </Text>
          <Button href={url} style={button}>
            Sign in
          </Button>
          <Text style={muted}>
            Or paste this into your browser:
            <br />
            {url}
          </Text>
          <Hr style={rule} />
          <Text style={muted}>
            If you didn&rsquo;t ask to sign in, you can ignore this — nobody can
            get in without this link.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

// PreviewProps drives `pnpm dev:email`, so the template renders in the preview pane without a
// real token.
MagicLinkEmail.PreviewProps = {
  url: "https://arbini.family/api/auth/magic-link/verify?token=preview",
  expiresInMinutes: 15,
} satisfies MagicLinkEmailProps;

export default MagicLinkEmail;

const body = {
  backgroundColor: "#ffffff",
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
};

const container = { margin: "0 auto", padding: "32px 24px", maxWidth: "480px" };

const heading = { fontSize: "20px", fontWeight: 600, color: "#111111" };

const text = { fontSize: "16px", lineHeight: "24px", color: "#333333" };

const button = {
  backgroundColor: "#111111",
  borderRadius: "8px",
  color: "#ffffff",
  fontSize: "16px",
  fontWeight: 600,
  padding: "12px 20px",
  textDecoration: "none",
  display: "inline-block",
};

const muted = {
  fontSize: "13px",
  lineHeight: "20px",
  color: "#666666",
  wordBreak: "break-all" as const,
};

const rule = { borderColor: "#eeeeee", margin: "24px 0" };
