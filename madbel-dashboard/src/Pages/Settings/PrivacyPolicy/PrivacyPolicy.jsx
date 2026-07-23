import { getPrivacyPolicy, upsertPrivacyPolicy } from "../../../services/cmsApi";
import LegalEditor from "../LegalEditor/LegalEditor";

const PrivacyPolicy = () => {
  return <LegalEditor title="Privacy Policy" loadContent={getPrivacyPolicy} saveContent={upsertPrivacyPolicy} />;
};

export default PrivacyPolicy;
