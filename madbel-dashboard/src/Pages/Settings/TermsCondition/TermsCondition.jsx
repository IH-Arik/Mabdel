import { getTermsAndConditions, upsertTermsAndConditions } from "../../../services/cmsApi";
import LegalEditor from "../LegalEditor/LegalEditor";

const TermsCondition = () => {
  return <LegalEditor title="Terms & Conditions" loadContent={getTermsAndConditions} saveContent={upsertTermsAndConditions} />;
};

export default TermsCondition;
