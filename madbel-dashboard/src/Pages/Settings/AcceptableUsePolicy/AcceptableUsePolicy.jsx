import { getAcceptableUsePolicy, upsertAcceptableUsePolicy } from "../../../services/cmsApi";
import LegalEditor from "../LegalEditor/LegalEditor";

const AcceptableUsePolicy = () => {
  return <LegalEditor title="Acceptable Use Policy" loadContent={getAcceptableUsePolicy} saveContent={upsertAcceptableUsePolicy} />;
};

export default AcceptableUsePolicy;
