import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from "react-email";

interface WelcomeEmailProps {
  name: string;
}

export function WelcomeEmail({ name }: WelcomeEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Welcome to arbini.family</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={heading}>Welcome to arbini.family</Heading>
          <Text style={text}>
            Hi {name}, this is a starter template. Replace it with your own --
            dev-env scaffolds it once and never rewrites it.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

const main = { backgroundColor: "#f6f9fc", padding: "24px 0" };
const container = {
  backgroundColor: "#ffffff",
  borderRadius: "8px",
  margin: "0 auto",
  padding: "32px",
};
const heading = { fontSize: "24px", fontWeight: 600, margin: "0 0 16px" };
const text = { fontSize: "16px", lineHeight: "24px", margin: "0" };

WelcomeEmail.PreviewProps = { name: "Ada" } satisfies WelcomeEmailProps;

export default WelcomeEmail;
